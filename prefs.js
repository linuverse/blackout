import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BlackoutPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {

        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();

        const row = new Adw.SpinRow({
            title: 'Idle time (minutes)',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 120,
                step_increment: 1,
            }),
        });

        settings.bind(
            'idle-minutes',
            row,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        group.add(row);
        page.add(group);

        window.add(page);
    }
}
