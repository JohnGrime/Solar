/*
    John Grime, Emerging Technologies Team, University of Oklahoma Libraries.
    This file contains utility routines for creating a simple user interface.
*/

// Strict mode automatic if loaded as a module, but it may not have been ...
"use strict";

export {
	UIControl      as Control,
	UIControlGroup as ControlGroup,

	createUI       as create,
};


// Defines a UI contol that connects to a specific variable
type UIControl = {
	key: string;
	set?: (x: any) => void;
	get?: ()       => any;
	
	min: number;
	max: number;

	def:    number;
	step?:   number;
	
	hasSlider?: boolean;
};


// A group of UI controls; if null, an additional spacer is inserted
type UIControlGroup = {
	caption: string;
	controls: UIControl[];
} | null;


function sanitiseNumber(
	toNumber: (x: any) => number,
	inputValue: any,
	minValue: number,
	maxValue: number,
	defaultValue: number) : number
{
	let v = toNumber(inputValue);
	if (isNaN(v))   v = defaultValue;
	if (v<minValue) v = minValue;
	if (v>maxValue) v = maxValue;
	return toNumber(v);
}


function createUI(
	container: any,
	controlGroups: UIControlGroup[],
	updateView: () => void) : void
{
	let check = (x: any, defVal: any) => (x == null) ? defVal : x;

	for (let group of controlGroups) {
		let div = document.createElement('div');

		if (group == null) {
			div.appendChild(document.createElement('BR'));
			div.appendChild(document.createElement('BR'));
			container.appendChild(div);
			continue;
		}

		let {caption, controls} = group;

		{
			let label = document.createElement('div');
			label.innerHTML = `${caption}`;
			container.appendChild(label);
		}

		for (let control of controls) {
			let slider: any = null;
			let {key, hasSlider, min, max, step, def} = control;

			def = check(def, 0);
			step = check(step, 1);
			hasSlider = check(hasSlider, false);

			if (hasSlider) {
				slider = document.createElement('input');
				slider.type = `range`;
				Object.assign(slider, {min: min, max: max, step: step, value: def});
				slider.oninput = function() {
					if (control && control.set) control.set(slider.value);
					if (updateView) updateView();
				};
				div.appendChild(slider);
			}

			let num = document.createElement('input');
			num.type = 'number';
			Object.assign(num, {min: min, max: max, step: step, value: def});
			div.appendChild(num);

			//num.oninput = function() { control.set(num.value); };
			num.onkeyup = function(e: KeyboardEvent) {
				if (e.key === 'Enter' || e.keyCode === 13) {
					if (control && control.set) control.set(num.value);
					if (updateView) updateView();
				}
			}

			control.set = function (x: any) {
				let value = sanitiseNumber(parseFloat, x, min, max, def);
				num.value = `${value}`;
				if (hasSlider) slider.value = value;
			}
			control.get = function () {
				let value = sanitiseNumber(parseFloat, num.value, min, max, def);
				return value;
			}
		}
		container.appendChild(div);
	}

	// Explicit update button
	let button = document.createElement('button');
	button.innerHTML = 'Update';
	button.onclick = function() {
		if (updateView) updateView();
	};
	container.appendChild(button);
}
