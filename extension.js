import St from 'gi://St';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class BlackoutExtension extends Extension {

    enable() {
        this._idleMonitor = global.backend.get_core_idle_monitor();

        this._idleWatch = 0;
        this._activeWatch = 0;

        this._actors = [];

        this._settings = this.getSettings();
        this._settingsChangedId = this._settings.connect(
            'changed::idle-minutes',
            () => {
                this._onIdleMinutesChanged();
            }
        );
        
        this._installIdleWatch();

        // GNOME 50
        this._tracker = global.backend.get_cursor_tracker?.();
        
    }

    disable() {
        if (this._idleWatch) {
            this._idleMonitor.remove_watch(this._idleWatch);
            this._idleWatch = 0;
        }

        if (this._activeWatch) {
            this._idleMonitor.remove_watch(this._activeWatch);
            this._activeWatch = 0;
        }

        if (this._tracker) {
            if (this._hasVisibilityInhibited && !this._tracker.get_pointer_visible())
                this._tracker.uninhibit_cursor_visibility();
            this._tracker = null;
            this._hasVisibilityInhibited = null;
        }
        
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        this._hideScreen();

    }
    
    _onIdleMinutesChanged() {
        if (this._idleWatch) {
            this._idleMonitor.remove_watch(this._idleWatch);
            this._idleWatch = 0;
        }

        this._installIdleWatch();
    }

    _installIdleWatch() {     
        const minutes = this._settings.get_int('idle-minutes');
        const timeout = minutes * 60 * 1000;
    
        this._idleWatch = this._idleMonitor.add_idle_watch(
            timeout,
            () => {
                this._idleWatch = 0;
                this._showScreen();
            }
        );
    }

    _showScreen() {
        if (this._actors.length > 0)
            return;

        // GNOME 48, 49
        if (Meta.Cursor) {
            global.display.set_cursor(Meta.Cursor.NONE);
        }

        // GNOME 50
        else if (global.backend.get_cursor_tracker) {
            if (this._tracker.get_pointer_visible()) {
                this._tracker.inhibit_cursor_visibility();
                this._hasVisibilityInhibited = true;
            }
        }

        const count = global.display.get_n_monitors();

        for (let i = 0; i < count; i++) {
            const m = global.display.get_monitor_geometry(i);

            const actor = new St.Widget({
                style: 'background-color: black;',
                reactive: true,
            });
            
            actor.set_position(m.x, m.y);
            actor.set_size(m.width, m.height);

            Main.layoutManager.addTopChrome(actor);
            
            actor.opacity = 0;
            
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                actor.ease({
                    opacity: 255,
                    duration: 3000,
                    mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
                });

                return GLib.SOURCE_REMOVE;
            });

            this._actors.push(actor);
        }

        this._activeWatch = this._idleMonitor.add_user_active_watch(() => {
            this._activeWatch = 0;
            this._hideScreen();
            this._installIdleWatch();
        });

    }

    _hideScreen() {
        const actors = this._actors;
        this._actors = [];
        
        for (const actor of actors) {
            actor.ease({
                opacity: 0,
                duration: 1000,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
                onComplete: () => actor.destroy()
            });
        }

        // GNOME 48, 49
        if (Meta.Cursor) {
            global.display.set_cursor(Meta.Cursor.DEFAULT);
        }

        // GNOME 50
        else if (global.backend.get_cursor_tracker) {
            if (this._hasVisibilityInhibited) {
                this._tracker.uninhibit_cursor_visibility();
                this._hasVisibilityInhibited = false; 
            }
                       
        }

    }
}
