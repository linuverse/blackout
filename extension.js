import St from 'gi://St';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class BlackoutExtension {

    enable() {
        this._idleMonitor = global.backend.get_core_idle_monitor();

        this._idleWatch = 0;
        this._activeWatch = 0;

        this._actors = [];
        this._previousProfile = null;

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

        this._hideScreen();

        this._powerProxy = null;
    }

    getPowerProxy() {
        if (this._powerProxy)
            return this._powerProxy;

        this._powerProxy = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            'net.hadess.PowerProfies',
            '/net/hadess/PowerProfiles',
            'org.freedesktop.DBus.Properties',
            null
        );

        return this._powerProxy;
    }

    getPowerProfile() {
        const proxy = this.getPowerProxy();
        
        const result = proxy.call_sync(
            'Get',
            new GLib.Variant(
                '(ss)',
                [
                    'net.hadess.PowerProfiles',
                    'ActiveProfile',
                ]
            ),
            Gio.DBusCallFlags.NONE,
            -1,
            null
        );

        return result.deepUnpack()[0].deepUnpack();
    }

    setPowerProfile(profile) {
        const proxy = this.getPowerProxy();
        
        proxy.call_sync(
            'Set',
            new GLib.Variant(
                '(ssv)',
                [
                    'net.hadess.PowerProfiles',
                    'ActiveProfile',
                    new GLib.Variant('s', profile),
                ]
            ),
            Gio.DBusCallFlags.NONE,
            -1,
            null
        );
    }

    _installIdleWatch() {
        this._idleWatch = this._idleMonitor.add_idle_watch(
            10 * 60 * 1000, // 10 minutes
            () => {
                this._idleWatch = 0;
                this._showScreen();
            }
        );
    }

    _showScreen() {
        if (this._actors.length > 0)
            return;

        this._previousProfile = this.getPowerProfile();

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

        this.setPowerProfile('power-saver');
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
            if (!this._tracker.get_pointer_visible()) {
                this._tracker.uninhibit_cursor_visibility();
            }
            this._hasVisibilityInhibited = false;            
        }

        if (this._previousProfile) {
            this.setPowerProfile(this._previousProfile);
        }
    }
}
