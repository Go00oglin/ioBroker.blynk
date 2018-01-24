var utils		= require(__dirname + '/lib/utils');
var adapter 	= utils.adapter('blynk');

var BlynkLib 	= require('blynk-library');
var blynk 		= null;

var timer      	= null;
var virtualPins = []; // undefined - not exists; 0 - was created before; >=1 - created now

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function addVirtualPin(nPin) {
    if (virtualPins[nPin] === undefined) {
        virtualPins[nPin] = 1;
    } else {
        virtualPins[nPin] ++;
    }
}

adapter.on('unload', function () {
	adapter.log.info("Unload adapter");
    if (timer) {
        clearInterval(timer);
        timer = 0;
    }
});

adapter.on('ready', function () {
    main();
});

function GetPinNumber(stateName) {
	var nameReg = /V(\d+)$/g;
	var nameMatched = nameReg.exec(stateName);
	if (nameMatched) {
		return nameMatched[1];
	}
	return undefined;
}

adapter.on('stateChange', function (id, state) {
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
	if (!state) {
		return;
	}
    // you can use the ack flag to detect if state is command(false) or status(true)
	if (!state.ack) {
		// check for source
		if (state.from != "system.adapter."+adapter.namespace) {
			if (blynk) {
				var nPin = GetPinNumber(id);
				adapter.log.info("VirtualWrite to " + nPin + " value:" + state.val);
				blynk.virtualWrite(nPin, state.val);
			}
		}
    }
});

function main() {
	adapter.log.info("Main");
	blynk = new BlynkLib.Blynk(adapter.config.auth, {"addr":adapter.config.server,"port":adapter.config.port});
	
	// Understand existing virtual Pins
	adapter.getStatesOf('', '', function (err, _states) {
			virtualPins.length = 0;
			var nPin;
			if (_states) {
				for (var j = 0; j < _states.length; j++) {
					adapter.log.info(JSON.stringify(_states[j]));
					var nPin = GetPinNumber(_states[j].common.name);
					if (nPin !== undefined) {
						virtualPins[nPin] = 0;
					}
				}
			};
			var ranges = adapter.config.vpins || "";
			ranges.split(/[\,;]/).forEach(function(item, i, arr) {
			  //check for single value or inteval  
			  if (isNumeric(item)) {
				  nPin = parseInt(item);
				  if ((nPin >= 0) && (nPin <= 127)) {
					addVirtualPin(nPin);
				  }
			  }
			  else {
				  var reg = /^(\d+)\s*-\s*(\d+)$/g;
				  var matched = reg.exec(item);
				  if (matched) {
					  var begin = parseInt(matched[1]);
					  var end = parseInt(matched[2]);
					  for (var n = begin; n <= end; n++) {
							if ((n >= 0) && ( n<= 127)) {
								addVirtualPin(n);
							}
						}
				  }
			  }
			});
			
			for (var i = 0; i <= 127; i++) { 
				if (virtualPins[i] == 0) {
					// delete object
					adapter.deleteState('V' +i );
				};
				if (virtualPins[i] >= 1) {
					var v = new blynk.VirtualPin(i);
					// add object
					adapter.setObject('V'+i, {
						type: 'state',
						common: {
							name: 'V'+i,
							type: 'mixed',
							role: 'text',
							desc: 'Virtual Pin #' + i
						},
						native: {
							blynk: v
						}
					});
					v.on('write', function(param) {
						var newValue = "" + param[0];
						var stateName = 'V' + this.pin;
						adapter.getState(stateName, function (err, state) {
							if (state) {
								if ("" + state.val != newValue) {
									
									adapter.log.info("setState [" + state.val  + " ][" + newValue + "]");
									
									adapter.setState(stateName, newValue, false);
								}
							}
							else {
								adapter.log.info("setState for new state [" + newValue + "]");
								adapter.setState(stateName, newValue, false);
							}
						});
					});
				}
			}
			var unterval = parseInt(adapter.config.interval);
			if (isNaN(unterval) || (unterval < 300)) {
				unterval = 300;
			}
			timer = setInterval(function() {
				if (blynk) {
					blynk.syncAll();
				}
			}, unterval);
			
			adapter.subscribeStates('V*');
	});

}


var ranges="70-80;20;3.1,75";
