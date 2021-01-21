/*
    John Grime, Emerging Technologies Team, University of Oklahoma Libraries.
    This file contains utility code to infer occurrence of specific solstace/equinox.
*/

// Strict mode automatic if loaded as a module, but it may not have been ...
"use strict";

export {
	Season as Season,
	toString as toString,
	GetSeasonUTC as GetSeasonUTC,
};

//
// Solstace / equinox calculations.
// Based on: https://phabricator.kde.org/R175:55e1d14fe900a5ac1acd3a76dfa51f8ccfa67b21
//

enum Season {
	March_Equinox,
	June_Solstice,
	September_Equinox,
	December_Solstice,
}

function toString(season: Season): string {
	return `${Season[season]}`.replace("_", " ");
}

function meanJDE(season: Season, year: number): number {
	if (year <= 1000) {
		// Astronomical Algorithms, Jean Meeus, chapter 26, table 26.A
		// mean season Julian dates for years -1000 to 1000
		const y = year / 1000.0;
		switch (season) {
			case Season.March_Equinox:
			return 1721139.29189 + (365242.13740 * y) + (0.06134 * Math.pow(y, 2)) + (0.00111 * Math.pow(y, 3)) - (0.00071 * Math.pow(y, 4));

			case Season.June_Solstice:
			return 1721233.25401 + (365241.72562 * y) - (0.05323 * Math.pow(y, 2)) + (0.00907 * Math.pow(y, 3)) + (0.00025 * Math.pow(y, 4));

			case Season.September_Equinox:
			return 1721325.70455 + (365242.49558 * y) - (0.11677 * Math.pow(y, 2)) - (0.00297 * Math.pow(y, 3)) + (0.00074 * Math.pow(y, 4));

			case Season.December_Solstice:
			return 1721414.39987 + (365242.88257 * y) - (0.00769 * Math.pow(y, 2)) - (0.00933 * Math.pow(y, 3)) - (0.00006 * Math.pow(y, 4));

			default:
			return 0;
		}
	} else {
		// Astronomical Algorithms, Jean Meeus, chapter 26, table 26.B
		// mean season Julian dates for years 1000 to 3000
		const y = (year - 2000) / 1000.0;
		switch (season) {
			case Season.March_Equinox:
			return 2451623.80984 + (365242.37404 * y) + (0.05169 * Math.pow(y, 2)) - (0.00411 * Math.pow(y, 3)) - (0.00057 * Math.pow(y, 4));

			case Season.June_Solstice:
			return 2451716.56767 + (365241.62603 * y) + (0.00325 * Math.pow(y, 2)) + (0.00888 * Math.pow(y, 3)) - (0.00030 * Math.pow(y, 4));

			case Season.September_Equinox:
			return 2451810.21715 + (365242.01767 * y) - (0.11575 * Math.pow(y, 2)) + (0.00337 * Math.pow(y, 3)) + (0.00078 * Math.pow(y, 4));

			case Season.December_Solstice:
			return 2451900.05952 + (365242.74049 * y) - (0.06223 * Math.pow(y, 2)) - (0.00823 * Math.pow(y, 3)) + (0.00032 * Math.pow(y, 4));

			default:
			return 0;
		}
	}

	return 0;
}

function periodicTerms(t: number): number {
	const rad = (x: number) => x*(Math.PI/180.0);

	// Astronomical Algorithms, Jean Meeus, chapter 26, table 26.C
	// The table gives the periodic terms in degrees, but the values are converted to radians
	// at compile time so that they can be passed to std::cos()

	const periodic: number[][] = [
		[485, rad(324.96), rad( 1934.136)], [203, rad(337.23), rad(32964.467)], [199, rad(342.08), rad(   20.186)], [182, rad( 27.85), rad(445267.112)],
		[156, rad( 73.14), rad(45036.886)], [136, rad(171.52), rad(22518.443)], [ 77, rad(222.54), rad(65928.934)], [ 74, rad(296.72), rad(  3034.906)],
		[ 70, rad(243.58), rad( 9037.513)], [ 58, rad(119.81), rad(33718.147)], [ 52, rad(297.17), rad(  150.678)], [ 50, rad( 21.02), rad(  2281.226)],
		[ 45, rad(247.54), rad(29929.562)], [ 44, rad(325.15), rad(31555.956)], [ 29, rad( 60.93), rad( 4443.417)], [ 18, rad(155.12), rad( 67555.328)],
		[ 17, rad(288.79), rad( 4562.452)], [ 16, rad(198.04), rad(62894.029)], [ 14, rad(199.76), rad(31436.921)], [ 12, rad( 95.39), rad( 14577.848)],
		[ 12, rad(287.11), rad(31931.756)], [ 12, rad(320.81), rad(34777.259)], [  9, rad(227.73), rad( 1222.114)], [  8, rad( 15.45), rad( 16859.074)]		
	];

	let val: number = 0;

	for (let [a,b_rad,c_rad] of periodic) {
		val += a * Math.cos(b_rad + c_rad * t);
	}

	return val;
}

// Returns julian date of given season in given year
function seasonJD(season: Season, year: number): number {
	// Astronomical Algorithms, Jean Meeus, chapter 26
	const jde0 = meanJDE(season, year);
	const T = (jde0 - 2451545.0) / 36525;
	const W_deg = 35999.373 * T + 2.47;
	const W_rad = W_deg * (Math.PI / 180.0);
	const dLambda = 1 + (0.0334 * Math.cos(W_rad)) + (0.0007 * Math.cos(2 * W_rad));
	const S = periodicTerms(T);
	return jde0 + (0.00001 * S) / dLambda;
}

//
// Julian date => UTC; Meeus Astronmical Algorithms Chapter 7
// Based on https://stellafane.org/misc/equinox.html
//

function ymd_hms_from_JD(J: number): number[] {
	const int = (x: number) => Math.floor(x);

	let A, alpha;
	let Z = int( J + 0.5 ); // Integer JDs
	let F = (J + 0.5) - Z;  // Fractional JDs
	if (Z < 2299161) {
		A = Z;
	}
	else {
		alpha = int( (Z-1867216.25) / 36524.25 );
		A = Z + 1 + alpha - int( alpha / 4 );
	}
	let B = A + 1524;
	let C = int( (B-122.1) / 365.25 );
	let D = int( 365.25*C );
	let E = int( ( B-D )/30.6001 );
	let DT = B - D - int(30.6001*E) + F; // Day of Month with decimals for time
	
	let Month = E - (E<13.5 ? 1 : 13); // Month Number
	let Year  = C - (Month>2.5 ? 4716 : 4715); // Year    
	let Day = int( DT );
	
	let H = 24*(DT - Day); // Hours and fractional hours 
	let Hour = int(H);
	
	let M = 60*(H - Hour); // Minutes and fractional minutes
	let Minute = int(M);
	
	let Second = int( 60*(M-Minute) );

	return [Year,Month,Day, Hour,Minute,Second];
}

function GetSeasonUTC(season: Season, year: number): number[] {
	let julian_day = seasonJD(season, year);
	return ymd_hms_from_JD(julian_day);
}
