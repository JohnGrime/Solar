/*
    John Grime, Emerging Technologies Team, University of Oklahoma Libraries.
    This file contains utility code for miscellaneous things.
*/

// Strict mode automatic if loaded as a module, but it may not have been ...
"use strict";

export {
	hms_to_dec as hms_to_dec,
	dec_to_hms as dec_to_hms,

	hms_to_sec as hms_to_sec,
	sec_to_hms as sec_to_hms,

	kelvin_to_rgb as kelvin_to_rgb,
};

//
// hour, minute, second <=> decimal hour
//

function hms_to_dec(h: number, m: number, s: number): number {
	let c = (h<0) ? -1 : 1;
	return h + (m*c)/60 + (s*c)/(60*60);
}

function dec_to_hms(dec: number): [number,number,number] {
	let c = (dec<0) ? -1 : 1;

	dec *= c;

	let h = Math.floor(dec);
	let x = (dec-h) * (60*60);
	let m = Math.floor(x/60);
	let s = Math.round(x%60);

	h *= c;

	return [h,m,s];
}

//
// hour, minute, second <=> seconds
//

function hms_to_sec(h: number, m: number, s: number): number {
	const [HOUR, MIN] = [60*60, 60]
	return h*HOUR + m*MIN + s
}

function sec_to_hms(s: number): [number, number, number] {
	const [HOUR, MIN] = [60*60, 60]
	let _h = Math.floor( (s/HOUR) )
	let _m = Math.floor( (s%HOUR) / MIN )
	let _s = Math.floor( (s%HOUR) % MIN )
	return [_h, _m, _s]
}

//
// https://gist.github.com/paulkaplan/5184275
//

function kelvin_to_rgb(K: number): [number,number,number] {
	let temp = K / 100;
	let r,g,b;

	if (temp <= 66) {
		r = 255;
		g = temp;
		g = 99.4708025861 * Math.log(g) - 161.1195681661;

		if (temp <= 19) {
			b = 0;
		} else {
			b = temp - 10;
			b = 138.5177312231 * Math.log(b) - 305.0447927307;
		}
	} else {
		r = temp - 60;
		r = 329.698727446 * Math.pow(r, -0.1332047592);

		g = temp - 60;
		g = 288.1221695283 * Math.pow(g, -0.0755148492 );

		b = 255;
	}

	let clamp = (x: number, x0: number, x1: number) => Math.min(Math.max(x,x0), x1);

	return [clamp(r,0,255), clamp(g,0,255), clamp(b,0,255)]
}
