import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';

function getPowerProfile() {  
    const proc = Gio.Subprocess.new(
        ['powerprofilesctl', 'get'],
        Gio.SubprocessFlags.STDOUT_PIPE
    );
  
    const [, stdout] = proc.communicate_utf8(null, null);
  
    return stdout.trim();  
}

export default class BlackScreenExtension {
  
	enable() {
    	this._idleMonitor = global.backend.get_core_idle_monitor();
    	this._idleWatch = 0;
    	this._activeWatch = 0;
		this._actors = []
    	this._installIdleWatch();
    	this._previousProfile = getPowerProfile();
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

    	this._hideScreen();
  	}

  	_installIdleWatch() {      
    	this._idleWatch = this._idleMonitor.add_idle_watch(1000 * 60 * 10, () => {
      		this._showScreen();
    	});      
  	}
	
	_showScreen() {
		global.display.set_cursor(Meta.Cursor.NONE);

	  	const count = global.display.get_n_monitors();

	  	for (let i = 0; i < count; i++) {

	    	const m = global.display.get_monitor_geometry(i);
      
      		const actor = new St.Widget({
	      		style: 'background-color: #000000;'
	    	});

	    	actor.reactive = true;
	    	actor.set_position(m.x, m.y);
	    	actor.set_size(m.width, m.height);

	    	Main.layoutManager.addTopChrome(actor);

			this._actors.push(actor);
		}

		this._activeWatch = this._idleMonitor.add_user_active_watch(() => {
      		this._hideScreen();
      		this._activeWatch = 0;
      		this._installIdleWatch();
    	});
        
    	Gio.Subprocess.new(
      		['powerprofilesctl', 'set', 'power-saver'],
      		Gio.SubprocessFlags.NONE
    	);        
  	}

  	_hideScreen() {
    	for (const actor of this._actors) actor.destroy();

	  	this._actors = [];

	  	global.display.set_cursor(Meta.Cursor.DEFAULT);
	    
	  	Gio.Subprocess.new(
      		['powerprofilesctl', 'set', this._previousProfile],
      		Gio.SubprocessFlags.NONE
    	);        
  	}
}
