/*

TypeScript version: John Grime, Emerging Tech, University of Oklahoma Libraries
Original message text below.

/////////////////////////////////////////////
//      Solar Position Algorithm (SPA)     //
//                   for                   //
//        Solar Radiation Application      //
//                                         //
//               May 12, 2003              //
//                                         //
//   Filename: SPA.C                       //
//                                         //
//   Afshin Michael Andreas                //
//   Afshin.Andreas@NREL.gov (303)384-6383 //
//                                         //
//   Metrology Laboratory                  //
//   Solar Radiation Research Laboratory   //
//   National Renewable Energy Laboratory  //
//   15013 Denver W Pkwy, Golden, CO 80401 //
/////////////////////////////////////////////

/////////////////////////////////////////////
//   See the SPA.H header file for usage   //
//                                         //
//   This code is based on the NREL        //
//   technical report "Solar Position      //
//   Algorithm for Solar Radiation         //
//   Application" by I. Reda & A. Andreas  //
/////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////////////////
//
//   NOTICE
//   Copyright (C) 2008-2011 Alliance for Sustainable Energy, LLC, All Rights Reserved
//
//The Solar Position Algorithm ("Software") is code in development prepared by employees of the
//Alliance for Sustainable Energy, LLC, (hereinafter the "Contractor"), under Contract No.
//DE-AC36-08GO28308 ("Contract") with the U.S. Department of Energy (the "DOE"). The United
//States Government has been granted for itself and others acting on its behalf a paid-up, non-
//exclusive, irrevocable, worldwide license in the Software to reproduce, prepare derivative
//works, and perform publicly and display publicly. Beginning five (5) years after the date
//permission to assert copyright is obtained from the DOE, and subject to any subsequent five
//(5) year renewals, the United States Government is granted for itself and others acting on
//its behalf a paid-up, non-exclusive, irrevocable, worldwide license in the Software to
//reproduce, prepare derivative works, distribute copies to the public, perform publicly and
//display publicly, and to permit others to do so. If the Contractor ceases to make this
//computer software available, it may be obtained from DOE's Office of Scientific and Technical
//Information's Energy Science and Technology Software Center (ESTSC) at P.O. Box 1020, Oak
//Ridge, TN 37831-1020. THIS SOFTWARE IS PROVIDED BY THE CONTRACTOR "AS IS" AND ANY EXPRESS OR
//IMPLIED WARRANTIES, INCLUDING BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY
//AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE CONTRACTOR OR THE
//U.S. GOVERNMENT BE LIABLE FOR ANY SPECIAL, INDIRECT OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
//WHATSOEVER, INCLUDING BUT NOT LIMITED TO CLAIMS ASSOCIATED WITH THE LOSS OF DATA OR PROFITS,
//WHICH MAY RESULT FROM AN ACTION IN CONTRACT, NEGLIGENCE OR OTHER TORTIOUS CLAIM THAT ARISES
//OUT OF OR IN CONNECTION WITH THE ACCESS, USE OR PERFORMANCE OF THIS SOFTWARE.
//
//The Software is being provided for internal, noncommercial purposes only and shall not be
//re-distributed. Please contact the NREL Commercialization and Technology Transfer Office
//for information concerning a commercial license to use the Software, visit:
//http://midcdmz.nrel.gov/spa/ for the contact information.
//
//As a condition of using the Software in an application, the developer of the application
//agrees to reference the use of the Software and make this Notice readily accessible to any
//end-user in a Help|About screen or equivalent manner.
//
///////////////////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////////////////
// Revised 27-FEB-2004 Andreas
//         Added bounds check on inputs and return value for spa_calculate().
// Revised 10-MAY-2004 Andreas
//         Changed temperature bound check minimum from -273.15 to -273 degrees C.
// Revised 17-JUN-2004 Andreas
//         Corrected a problem that caused a bogus sunrise/set/transit on the equinox.
// Revised 18-JUN-2004 Andreas
//         Added a "function" input variable that allows the selecting of desired outputs.
// Revised 21-JUN-2004 Andreas
//         Added 3 new intermediate output values to SPA structure (srha, ssha, & sta).
// Revised 23-JUN-2004 Andreas
//         Enumerations for "function" were renamed and 2 were added.
//         Prevented bound checks on inputs that are not used (based on function).
// Revised 01-SEP-2004 Andreas
//         Changed a local variable from integer to double.
// Revised 12-JUL-2005 Andreas
//         Put a limit on the EOT calculation, so that the result is between -20 and 20.
// Revised 26-OCT-2005 Andreas
//         Set the atmos. refraction correction to zero, when sun is below horizon.
//         Made atmos_refract input a requirement for all "functions".
//         Changed atmos_refract bound check from +/- 10 to +/- 5 degrees.
// Revised 07-NOV-2006 Andreas
//         Corrected 3 earth periodic terms in the L_TERMS array.
//         Corrected 2 earth periodic terms in the R_TERMS array.
// Revised 10-NOV-2006 Andreas
//         Corrected a constant used to calculate topocentric sun declination.
//         Put a limit on observer hour angle, so result is between 0 and 360.
// Revised 13-NOV-2006 Andreas
//         Corrected calculation of topocentric sun declination.
//         Converted all floating point inputs in spa structure to doubles.
// Revised 27-FEB-2007 Andreas
//         Minor correction made as to when atmos. refraction correction is set to zero.
// Revised 21-JAN-2008 Andreas
//         Minor change to two variable declarations.
// Revised 12-JAN-2009 Andreas
//         Changed timezone bound check from +/-12 to +/-18 hours.
// Revised 14-JAN-2009 Andreas
//         Corrected a constant used to calculate ecliptic mean obliquity.
// Revised 01-APR-2013 Andreas
//		   Replace floor with new integer function for tech. report consistency, no affect on results.
//         Add "utility" function prototypes to header file for use with NREL's SAMPA.
//         Rename 4 "utility" function names (remove "sun") for clarity with NREL's SAMPA.
//		   Added delta_ut1 as required input, which the fractional second difference between UT and UTC.
//         Time must be input w/o delta_ut1 adjustment, instead of assuming adjustment was pre-applied.
// Revised 10-JUL-2014 Andreas
//         Change second in spa_data structure from an integer to double to allow fractional second
// Revised 08-SEP-2014 Andreas
//         Corrected description of azm_rotation in header file
//         Limited azimuth180 to range of 0 to 360 deg (instead of -180 to 180) for tech report consistency
//         Changed all variables names from azimuth180 to azimuth_astro
//         Renamed 2 "utility" function names for consistency
///////////////////////////////////////////////////////////////////////////////////////////////

*/

// Strict mode automatic if loaded as a module, but it may not have been ...
"use strict";

export {
    SPA           as SPA,

    spa_alloc     as alloc,
    spa_calculate as calculate,
    spa_print     as print,
    spa_test      as test,

    CalculateWhat as CalculateWhat,
};

// Enumeration for function codes to select desired final outputs from SPA
const enum CalculateWhat {
    ZenithAzimuth,          // calculate zenith and azimuth
    ZenithAzimuthIncidence, // calculate zenith, azimuth, and incidence
    ZenithAzimuthSun,       // calculate zenith, azimuth, and sun rise/transit/set
    All,                    // calculate everything
}

// Extend Record<>. so we can access members by name string (handy for e.g. linking to GUI controls)
interface SPA extends Record<string,any> {

    //----------------------INPUT VALUES------------------------

    year:   number; // 4-digit year,      valid range: -2000 to 6000, error code: 1
    month:  number; // 2-digit month,         valid range: 1 to  12,  error code: 2
    day:    number; // 2-digit day,           valid range: 1 to  31,  error code: 3
    hour:   number; // Observer local hour,   valid range: 0 to  24,  error code: 4
    minute: number; // Observer local minute, valid range: 0 to  59,  error code: 5
    second: number; // Observer local second, valid range: 0 to <60,  error code: 6

    delta_ut1: number; // Fractional second difference between UTC and UT which is used
                       // to adjust UTC for earth's irregular rotation rate and is derived
                       // from observation only and is reported in this bulletin:
                       // http://maia.usno.navy.mil/ser7/ser7.dat,
                       // where delta_ut1 = DUT1
                       // valid range: -1 to 1 second (exclusive), error code 17

    delta_t: number;   // Difference between earth rotation time and terrestrial time
                       // It is derived from observation only and is reported in this
                       // bulletin: http://maia.usno.navy.mil/ser7/ser7.dat,
                       // where delta_t = 32.184 + (TAI-UTC) - DUT1
                       // valid range: -8000 to 8000 seconds, error code: 7

    timezone: number;  // Observer time zone (negative west of Greenwich)
                       // valid range: -18   to   18 hours,   error code: 8

    longitude: number; // Observer longitude (negative west of Greenwich)
                       // valid range: -180  to  180 degrees, error code: 9

    latitude: number;  // Observer latitude (negative south of equator)
                       // valid range: -90   to   90 degrees, error code: 10

    elevation: number; // Observer elevation [meters]
                       // valid range: -6500000 or higher meters,    error code: 11

    pressure: number;  // Annual average local pressure [millibars]
                       // valid range:    0 to 5000 millibars,       error code: 12

    temperature: number; // Annual average local temperature [degrees Celsius]
                         // valid range: -273 to 6000 degrees Celsius, error code; 13

    slope: number; // Surface slope (measured from the horizontal plane)
                   // valid range: -360 to 360 degrees, error code: 14

    azm_rotation: number; // Surface azimuth rotation (measured from south to projection of
                          // surface normal on horizontal plane, negative east)
                          // valid range: -360 to 360 degrees, error code: 15

    atmos_refract: number; // Atmospheric refraction at sunrise and sunset (0.5667 deg is typical)
                           // valid range: -5   to   5 degrees, error code: 16

    function: CalculateWhat; // Switch to choose functions for desired output (from enumeration)

    //-----------------Intermediate OUTPUT VALUES--------------------

    jd: number; // Julian day
    jc: number; // Julian century

    jde: number; // Julian ephemeris day
    jce: number; // Julian ephemeris century
    jme: number; // Julian ephemeris millennium

    l: number; // earth heliocentric longitude [degrees]
    b: number; // earth heliocentric latitude [degrees]
    r: number; // earth radius vector [Astronomical Units, AU]

    theta: number; // geocentric longitude [degrees]
    beta:  number; // geocentric latitude [degrees]

    x0: number; // mean elongation (moon-sun) [degrees]
    x1: number; // mean anomaly (sun) [degrees]
    x2: number; // mean anomaly (moon) [degrees]
    x3: number; // argument latitude (moon) [degrees]
    x4: number; // ascending longitude (moon) [degrees]

    del_psi:     number; // nutation longitude [degrees]
    del_epsilon: number; // nutation obliquity [degrees]
    epsilon0:    number; // ecliptic mean obliquity [arc seconds]
    epsilon:     number; // ecliptic true obliquity  [degrees]

    del_tau: number; // aberration correction [degrees]
    lamda:   number; // apparent sun longitude [degrees]
    nu0:     number; // Greenwich mean sidereal time [degrees]
    nu:      number; // Greenwich sidereal time [degrees]

    alpha: number; // geocentric sun right ascension [degrees]
    delta: number; // geocentric sun declination [degrees]

    h:           number; // observer hour angle [degrees]
    xi:          number; // sun equatorial horizontal parallax [degrees]
    del_alpha:   number; // sun right ascension parallax [degrees]
    delta_prime: number; // topocentric sun declination [degrees]
    alpha_prime: number; // topocentric sun right ascension [degrees]
    h_prime:     number; //topocentric local hour angle [degrees]

    e0:    number; // topocentric elevation angle (uncorrected) [degrees]
    del_e: number; // atmospheric refraction correction [degrees]
    e:     number; // topocentric elevation angle (corrected) [degrees]

    eot:  number; // equation of time [minutes]
    srha: number; // sunrise hour angle [degrees]
    ssha: number; // sunset hour angle [degrees]
    sta:  number; // sun transit altitude [degrees]

    //---------------------Final OUTPUT VALUES------------------------

    zenith:        number; // topocentric zenith angle [degrees]
    azimuth_astro: number; // topocentric azimuth angle (westward from south) [for astronomers]
    azimuth:       number; // topocentric azimuth angle (eastward from north) [for navigators and solar radiation]
    incidence:     number; // surface incidence angle [degrees]

    suntransit: number; // local sun transit time (or solar noon) [fractional hour]
    sunrise:    number; // local sunrise time (+/- 30 seconds) [fractional hour]
    sunset:     number; // local sunset time (+/- 30 seconds) [fractional hour]
}

function spa_alloc() : SPA {
    return {
        year:          0,
        month:         1,
        day:           1,
        hour:          0,
        minute:        0,
        second:        0,
        delta_ut1:     0.0,
        delta_t:       0.0,
        timezone:      0.0,
        longitude:     0.0,
        latitude:      0.0,
        elevation:     0.0,
        pressure:      0.0,
        temperature:   0.0,
        slope:         0.0,
        azm_rotation:  0.0,
        atmos_refract: 0.0,
        function:      CalculateWhat.All,

        jd:          0.0,
        jc:          0.0,
        jde:         0.0,
        jce:         0.0,
        jme:         0.0,
        l:           0.0,
        b:           0.0,
        r:           0.0,
        theta:       0.0,
        beta:        0.0,
        x0:          0.0,
        x1:          0.0,
        x2:          0.0,
        x3:          0.0,
        x4:          0.0,
        del_psi:     0.0,
        del_epsilon: 0.0,
        epsilon0:    0.0,
        epsilon:     0.0,
        del_tau:     0.0,
        lamda:       0.0,
        nu0:         0.0,
        nu:          0.0,
        alpha:       0.0,
        delta:       0.0,
        h:           0.0,
        xi:          0.0,
        del_alpha:   0.0,
        delta_prime: 0.0,
        alpha_prime: 0.0,
        h_prime:     0.0,
        e0:          0.0,
        del_e:       0.0,
        e:           0.0,
        eot:         0.0,
        srha:        0.0,
        ssha:        0.0,
        sta:         0.0,

        zenith:        0.0,
        azimuth_astro: 0.0,
        azimuth:       0.0,
        incidence:     0.0,
        suntransit:    0.0,
        sunrise:       0.0,
        sunset:        0.0,
    };
}

// ******************************************************************

// Could swap for Math.pi, but let's leave it hardwired as in the original code
const PI = 3.1415926535897932384626433832795028841971;
const SUN_RADIUS = 0.26667

// enum {TERM_A, TERM_B, TERM_C, TERM_COUNT}; TERM_COUNT ignored.
const TERM_A = 0;
const TERM_B = 1;
const TERM_C = 2;

// enum {TERM_X0, TERM_X1, TERM_X2, TERM_X3, TERM_X4, TERM_X_COUNT};
const TERM_X0 = 0;
const TERM_X1 = 1;
const TERM_X2 = 2;
const TERM_X3 = 3;
const TERM_X4 = 4;
const TERM_X_COUNT = 5;

// enum {TERM_PSI_A, TERM_PSI_B, TERM_EPS_C, TERM_EPS_D, TERM_PE_COUNT}; TERM_PE_COUNT ignored.
const TERM_PSI_A = 0;
const TERM_PSI_B = 1;
const TERM_EPS_C = 2;
const TERM_EPS_D = 3;

// enum {JD_MINUS, JD_ZERO, JD_PLUS, JD_COUNT};
const JD_MINUS = 0;
const JD_ZERO  = 1;
const JD_PLUS  = 2;
const JD_COUNT = 3;

// enum {SUN_TRANSIT, SUN_RISE, SUN_SET, SUN_COUNT};
const SUN_TRANSIT = 0;
const SUN_RISE = 1;
const SUN_SET = 2;
const SUN_COUNT = 3;

// #define TERM_Y_COUNT TERM_X_COUNT
const TERM_Y_COUNT = TERM_X_COUNT;

///////////////////////////////////////////////////
///  Earth Periodic Terms
///////////////////////////////////////////////////
const L_TERMS = [
    [
        [175347046.0,0,0],
        [3341656.0,4.6692568,6283.07585],
        [34894.0,4.6261,12566.1517],
        [3497.0,2.7441,5753.3849],
        [3418.0,2.8289,3.5231],
        [3136.0,3.6277,77713.7715],
        [2676.0,4.4181,7860.4194],
        [2343.0,6.1352,3930.2097],
        [1324.0,0.7425,11506.7698],
        [1273.0,2.0371,529.691],
        [1199.0,1.1096,1577.3435],
        [990,5.233,5884.927],
        [902,2.045,26.298],
        [857,3.508,398.149],
        [780,1.179,5223.694],
        [753,2.533,5507.553],
        [505,4.583,18849.228],
        [492,4.205,775.523],
        [357,2.92,0.067],
        [317,5.849,11790.629],
        [284,1.899,796.298],
        [271,0.315,10977.079],
        [243,0.345,5486.778],
        [206,4.806,2544.314],
        [205,1.869,5573.143],
        [202,2.458,6069.777],
        [156,0.833,213.299],
        [132,3.411,2942.463],
        [126,1.083,20.775],
        [115,0.645,0.98],
        [103,0.636,4694.003],
        [102,0.976,15720.839],
        [102,4.267,7.114],
        [99,6.21,2146.17],
        [98,0.68,155.42],
        [86,5.98,161000.69],
        [85,1.3,6275.96],
        [85,3.67,71430.7],
        [80,1.81,17260.15],
        [79,3.04,12036.46],
        [75,1.76,5088.63],
        [74,3.5,3154.69],
        [74,4.68,801.82],
        [70,0.83,9437.76],
        [62,3.98,8827.39],
        [61,1.82,7084.9],
        [57,2.78,6286.6],
        [56,4.39,14143.5],
        [56,3.47,6279.55],
        [52,0.19,12139.55],
        [52,1.33,1748.02],
        [51,0.28,5856.48],
        [49,0.49,1194.45],
        [41,5.37,8429.24],
        [41,2.4,19651.05],
        [39,6.17,10447.39],
        [37,6.04,10213.29],
        [37,2.57,1059.38],
        [36,1.71,2352.87],
        [36,1.78,6812.77],
        [33,0.59,17789.85],
        [30,0.44,83996.85],
        [30,2.74,1349.87],
        [25,3.16,4690.48]
    ],
    [
        [628331966747.0,0,0],
        [206059.0,2.678235,6283.07585],
        [4303.0,2.6351,12566.1517],
        [425.0,1.59,3.523],
        [119.0,5.796,26.298],
        [109.0,2.966,1577.344],
        [93,2.59,18849.23],
        [72,1.14,529.69],
        [68,1.87,398.15],
        [67,4.41,5507.55],
        [59,2.89,5223.69],
        [56,2.17,155.42],
        [45,0.4,796.3],
        [36,0.47,775.52],
        [29,2.65,7.11],
        [21,5.34,0.98],
        [19,1.85,5486.78],
        [19,4.97,213.3],
        [17,2.99,6275.96],
        [16,0.03,2544.31],
        [16,1.43,2146.17],
        [15,1.21,10977.08],
        [12,2.83,1748.02],
        [12,3.26,5088.63],
        [12,5.27,1194.45],
        [12,2.08,4694],
        [11,0.77,553.57],
        [10,1.3,6286.6],
        [10,4.24,1349.87],
        [9,2.7,242.73],
        [9,5.64,951.72],
        [8,5.3,2352.87],
        [6,2.65,9437.76],
        [6,4.67,4690.48]
    ],
    [
        [52919.0,0,0],
        [8720.0,1.0721,6283.0758],
        [309.0,0.867,12566.152],
        [27,0.05,3.52],
        [16,5.19,26.3],
        [16,3.68,155.42],
        [10,0.76,18849.23],
        [9,2.06,77713.77],
        [7,0.83,775.52],
        [5,4.66,1577.34],
        [4,1.03,7.11],
        [4,3.44,5573.14],
        [3,5.14,796.3],
        [3,6.05,5507.55],
        [3,1.19,242.73],
        [3,6.12,529.69],
        [3,0.31,398.15],
        [3,2.28,553.57],
        [2,4.38,5223.69],
        [2,3.75,0.98]
    ],
    [
        [289.0,5.844,6283.076],
        [35,0,0],
        [17,5.49,12566.15],
        [3,5.2,155.42],
        [1,4.72,3.52],
        [1,5.3,18849.23],
        [1,5.97,242.73]
    ],
    [
        [114.0,3.142,0],
        [8,4.13,6283.08],
        [1,3.84,12566.15]
    ],
    [
        [1,3.14,0]
    ]
];
const L_SUBCOUNTS = L_TERMS.map(x => x.length);
const L_COUNT = L_SUBCOUNTS.length;


const B_TERMS = [
    [
        [280.0,3.199,84334.662],
        [102.0,5.422,5507.553],
        [80,3.88,5223.69],
        [44,3.7,2352.87],
        [32,4,1577.34]
    ],
    [
        [9,3.9,5507.55],
        [6,1.73,5223.69]
    ]
];
const B_SUBCOUNTS = B_TERMS.map(x => x.length);
const B_COUNT = B_SUBCOUNTS.length;

const R_TERMS = [
    [
        [100013989.0,0,0],
        [1670700.0,3.0984635,6283.07585],
        [13956.0,3.05525,12566.1517],
        [3084.0,5.1985,77713.7715],
        [1628.0,1.1739,5753.3849],
        [1576.0,2.8469,7860.4194],
        [925.0,5.453,11506.77],
        [542.0,4.564,3930.21],
        [472.0,3.661,5884.927],
        [346.0,0.964,5507.553],
        [329.0,5.9,5223.694],
        [307.0,0.299,5573.143],
        [243.0,4.273,11790.629],
        [212.0,5.847,1577.344],
        [186.0,5.022,10977.079],
        [175.0,3.012,18849.228],
        [110.0,5.055,5486.778],
        [98,0.89,6069.78],
        [86,5.69,15720.84],
        [86,1.27,161000.69],
        [65,0.27,17260.15],
        [63,0.92,529.69],
        [57,2.01,83996.85],
        [56,5.24,71430.7],
        [49,3.25,2544.31],
        [47,2.58,775.52],
        [45,5.54,9437.76],
        [43,6.01,6275.96],
        [39,5.36,4694],
        [38,2.39,8827.39],
        [37,0.83,19651.05],
        [37,4.9,12139.55],
        [36,1.67,12036.46],
        [35,1.84,2942.46],
        [33,0.24,7084.9],
        [32,0.18,5088.63],
        [32,1.78,398.15],
        [28,1.21,6286.6],
        [28,1.9,6279.55],
        [26,4.59,10447.39]
    ],
    [
        [103019.0,1.10749,6283.07585],
        [1721.0,1.0644,12566.1517],
        [702.0,3.142,0],
        [32,1.02,18849.23],
        [31,2.84,5507.55],
        [25,1.32,5223.69],
        [18,1.42,1577.34],
        [10,5.91,10977.08],
        [9,1.42,6275.96],
        [9,0.27,5486.78]
    ],
    [
        [4359.0,5.7846,6283.0758],
        [124.0,5.579,12566.152],
        [12,3.14,0],
        [9,3.63,77713.77],
        [6,1.87,5573.14],
        [3,5.47,18849.23]
    ],
    [
        [145.0,4.273,6283.076],
        [7,3.92,12566.15]
    ],
    [
        [4,2.56,6283.08]
    ]
];
const R_SUBCOUNTS = R_TERMS.map(x => x.length);
const R_COUNT = R_SUBCOUNTS.length;

////////////////////////////////////////////////////////////////
///  Periodic Terms for the nutation in longitude and obliquity
////////////////////////////////////////////////////////////////

const Y_TERMS = [
    [0,0,0,0,1],
    [-2,0,0,2,2],
    [0,0,0,2,2],
    [0,0,0,0,2],
    [0,1,0,0,0],
    [0,0,1,0,0],
    [-2,1,0,2,2],
    [0,0,0,2,1],
    [0,0,1,2,2],
    [-2,-1,0,2,2],
    [-2,0,1,0,0],
    [-2,0,0,2,1],
    [0,0,-1,2,2],
    [2,0,0,0,0],
    [0,0,1,0,1],
    [2,0,-1,2,2],
    [0,0,-1,0,1],
    [0,0,1,2,1],
    [-2,0,2,0,0],
    [0,0,-2,2,1],
    [2,0,0,2,2],
    [0,0,2,2,2],
    [0,0,2,0,0],
    [-2,0,1,2,2],
    [0,0,0,2,0],
    [-2,0,0,2,0],
    [0,0,-1,2,1],
    [0,2,0,0,0],
    [2,0,-1,0,1],
    [-2,2,0,2,2],
    [0,1,0,0,1],
    [-2,0,1,0,1],
    [0,-1,0,0,1],
    [0,0,2,-2,0],
    [2,0,-1,2,1],
    [2,0,1,2,2],
    [0,1,0,2,2],
    [-2,1,1,0,0],
    [0,-1,0,2,2],
    [2,0,0,2,1],
    [2,0,1,0,0],
    [-2,0,2,2,2],
    [-2,0,1,2,1],
    [2,0,-2,0,1],
    [2,0,0,0,1],
    [0,-1,1,0,0],
    [-2,-1,0,2,1],
    [-2,0,0,0,1],
    [0,0,2,2,1],
    [-2,0,2,0,1],
    [-2,1,0,2,1],
    [0,0,1,-2,0],
    [-1,0,1,0,0],
    [-2,1,0,0,0],
    [1,0,0,0,0],
    [0,0,1,2,0],
    [0,0,-2,2,2],
    [-1,-1,1,0,0],
    [0,1,1,0,0],
    [0,-1,1,2,2],
    [2,-1,-1,2,2],
    [0,0,3,2,2],
    [2,-1,0,2,2],
];
const Y_COUNT = Y_TERMS.length;

const PE_TERMS = [
    [-171996,-174.2,92025,8.9],
    [-13187,-1.6,5736,-3.1],
    [-2274,-0.2,977,-0.5],
    [2062,0.2,-895,0.5],
    [1426,-3.4,54,-0.1],
    [712,0.1,-7,0],
    [-517,1.2,224,-0.6],
    [-386,-0.4,200,0],
    [-301,0,129,-0.1],
    [217,-0.5,-95,0.3],
    [-158,0,0,0],
    [129,0.1,-70,0],
    [123,0,-53,0],
    [63,0,0,0],
    [63,0.1,-33,0],
    [-59,0,26,0],
    [-58,-0.1,32,0],
    [-51,0,27,0],
    [48,0,0,0],
    [46,0,-24,0],
    [-38,0,16,0],
    [-31,0,13,0],
    [29,0,0,0],
    [29,0,-12,0],
    [26,0,0,0],
    [-22,0,0,0],
    [21,0,-10,0],
    [17,-0.1,0,0],
    [16,0,-8,0],
    [-16,0.1,7,0],
    [-15,0,9,0],
    [-13,0,7,0],
    [-12,0,6,0],
    [11,0,0,0],
    [-10,0,5,0],
    [-8,0,3,0],
    [7,0,-3,0],
    [-7,0,0,0],
    [-7,0,3,0],
    [-7,0,3,0],
    [6,0,0,0],
    [6,0,-3,0],
    [6,0,-3,0],
    [-6,0,3,0],
    [-6,0,3,0],
    [5,0,0,0],
    [-5,0,3,0],
    [-5,0,3,0],
    [-5,0,3,0],
    [4,0,0,0],
    [4,0,0,0],
    [4,0,0,0],
    [-4,0,0,0],
    [-4,0,0,0],
    [-4,0,0,0],
    [3,0,0,0],
    [-3,0,0,0],
    [-3,0,0,0],
    [-3,0,0,0],
    [-3,0,0,0],
    [-3,0,0,0],
    [-3,0,0,0],
    [-3,0,0,0],
];

///////////////////////////////////////////////

function rad2deg(radians: number) : number {
    return (180.0/PI)*radians;
}

function deg2rad(degrees: number) : number {
    return (PI/180.0)*degrees;
}

function integer(value: number) : number {
    return Math.floor(value);
}

function limit_degrees(degrees: number) : number {
    degrees /= 360.0;
    let limited = 360.0*(degrees-Math.floor(degrees));
    return (limited<0) ? limited+360.0 : limited;
}

function limit_degrees180pm(degrees: number) : number {
    degrees /= 360.0;
    let limited = 360.0*(degrees-Math.floor(degrees));
    if      (limited < -180.0) limited += 360.0;
    else if (limited >  180.0) limited -= 360.0;
    return limited;
}

function limit_degrees180(degrees: number) : number {
    degrees /= 180.0;
    let limited = 180.0*(degrees-Math.floor(degrees));
    return (limited<0) ? limited+180.0 : limited;
}

function limit_zero2one(value: number) : number {
    let limited = value - Math.floor(value);
    return (limited<0) ? limited+1.0 : limited;
}

function limit_minutes(minutes: number) : number {
    let limited = minutes;
    if      (limited < -20.0) limited += 1440.0;
    else if (limited >  20.0) limited -= 1440.0;
    return limited;
}

function dayfrac_to_local_hr(dayfrac: number, timezone: number) : number {
    return 24.0*limit_zero2one(dayfrac + timezone/24.0);
}

function third_order_polynomial(
    a: number,
    b: number,
    c: number,
    d: number,
    x: number) : number
{
    return ((a*x + b)*x + c)*x + d;
}

///////////////////////////////////////////////////////////////////////////////////////////////
function validate_inputs(spa: any) : number {
    if ((spa.year        < -2000) || (spa.year        > 6000)) return 1;
    if ((spa.month       < 1    ) || (spa.month       > 12  )) return 2;
    if ((spa.day         < 1    ) || (spa.day         > 31  )) return 3;
    if ((spa.hour        < 0    ) || (spa.hour        > 24  )) return 4;
    if ((spa.minute      < 0    ) || (spa.minute      > 59  )) return 5;
    if ((spa.second      < 0    ) || (spa.second      >=60  )) return 6;
    if ((spa.pressure    < 0    ) || (spa.pressure    > 5000)) return 12;
    if ((spa.temperature <= -273) || (spa.temperature > 6000)) return 13;
    if ((spa.delta_ut1   <= -1  ) || (spa.delta_ut1   >= 1  )) return 17;
    if ((spa.hour        == 24  ) && (spa.minute      > 0   )) return 5;
    if ((spa.hour        == 24  ) && (spa.second      > 0   )) return 6;

    if (Math.abs(spa.delta_t)       > 8000    ) return 7;
    if (Math.abs(spa.timezone)      > 18      ) return 8;
    if (Math.abs(spa.longitude)     > 180     ) return 9;
    if (Math.abs(spa.latitude)      > 90      ) return 10;
    if (Math.abs(spa.atmos_refract) > 5       ) return 16;
    if (         spa.elevation      < -6500000) return 11;

    if ((spa.function == CalculateWhat.ZenithAzimuthIncidence) ||
        (spa.function == CalculateWhat.All))
    {
        if (Math.abs(spa.slope)         > 360) return 14;
        if (Math.abs(spa.azm_rotation)  > 360) return 15;
    }

    // Should be redundant now, but retained anyway.
    if (spa.function == CalculateWhat.ZenithAzimuth) {}
    else if (spa.function == CalculateWhat.ZenithAzimuthIncidence) {}
    else if (spa.function == CalculateWhat.ZenithAzimuthSun) {}
    else if (spa.function == CalculateWhat.All) {}
    else { return 18; }

    return 0;
}
///////////////////////////////////////////////////////////////////////////////////////////////
function julian_day (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    dut1: number,
    tz: number) : number
{
    const day_decimal = day + (hour - tz + (minute + (second + dut1)/60.0)/60.0)/24.0;

    if (month < 3) {
        month += 12;
        year--;
    }

    let julian_day = integer(365.25*(year+4716.0)) + integer(30.6001*(month+1)) + day_decimal - 1524.5;

    if (julian_day > 2299160.0) {
        let a = integer(year/100);
        julian_day += (2 - a + integer(a/4));
    }

    return julian_day;
}

function julian_century(jd: number) : number {
    return (jd-2451545.0)/36525.0;
}

function julian_ephemeris_day(jd: number, delta_t: number) : number {
    return jd+delta_t/86400.0;
}

function julian_ephemeris_century(jde: number) : number {
    return (jde - 2451545.0)/36525.0;
}

function julian_ephemeris_millennium(jce: number) : number {
    return (jce/10.0);
}

function earth_periodic_term_summation(
    terms: number[][],
    count: number,
    jme: number) : number
{
    let sum = 0.0;

    for (let i = 0; i < count; i++) {
        sum += terms[i][TERM_A]*Math.cos(terms[i][TERM_B]+terms[i][TERM_C]*jme);
    }

    return sum;
}

function earth_values(
    term_sum: number[],
    count: number,
    jme: number) : number
{
    let sum = 0.0;

    for (let i = 0; i < count; i++) {
        sum += term_sum[i]*Math.pow(jme, i);
    }

    sum /= 1.0e8;

    return sum;
}

function earth_heliocentric_longitude(jme: number) : number {
    let sum = []

    for (let i = 0; i < L_COUNT; i++)
        sum.push( earth_periodic_term_summation(L_TERMS[i], L_SUBCOUNTS[i], jme) );

    return limit_degrees( rad2deg(earth_values(sum, L_COUNT, jme)) );

}

function earth_heliocentric_latitude(jme: number) : number {
    let sum = [];

    for (let i = 0; i < B_COUNT; i++)
        sum.push( earth_periodic_term_summation(B_TERMS[i], B_SUBCOUNTS[i], jme) );

    return rad2deg(earth_values(sum, B_COUNT, jme));

}

function earth_radius_vector(jme: number) : number {
    let sum = [];

    for (let i = 0; i < R_COUNT; i++)
        sum.push( earth_periodic_term_summation(R_TERMS[i], R_SUBCOUNTS[i], jme) );

    return earth_values(sum, R_COUNT, jme);

}

function geocentric_longitude(l: number) : number {
    const theta = l + 180.0;
    return (theta>=360.0) ? theta-360.0 : theta;
}

function geocentric_latitude(b: number) : number {
    return -b;
}

function mean_elongation_moon_sun(jce: number) : number {
    return third_order_polynomial(1.0/189474.0, -0.0019142, 445267.11148, 297.85036, jce);
}

function mean_anomaly_sun(jce: number) : number {
    return third_order_polynomial(-1.0/300000.0, -0.0001603, 35999.05034, 357.52772, jce);
}

function mean_anomaly_moon(jce: number) : number {
    return third_order_polynomial(1.0/56250.0, 0.0086972, 477198.867398, 134.96298, jce);
}

function argument_latitude_moon(jce: number) : number {
    return third_order_polynomial(1.0/327270.0, -0.0036825, 483202.017538, 93.27191, jce);
}

function ascending_longitude_moon(jce: number) : number {
    return third_order_polynomial(1.0/450000.0, 0.0020708, -1934.136261, 125.04452, jce);
}

function xy_term_summation(i: number, x: number[]) : number {
    let sum = 0.0;

    for (let j = 0; j < TERM_Y_COUNT; j++) {
        sum += x[j]*Y_TERMS[i][j];
    }

    return sum;
}

// Modification of del_psi, del_epsilon reference params changed to return of tuple
function nutation_longitude_and_obliquity(
    jce: number,
    x: number[],
    del_psi: number,
    del_epsilon: number) : [number, number]
{
    let sum_psi = 0.0, sum_epsilon = 0.0;

    for (let i = 0; i < Y_COUNT; i++) {
        const xy_term_sum  = deg2rad(xy_term_summation(i, x));
        sum_psi     += (PE_TERMS[i][TERM_PSI_A] + jce*PE_TERMS[i][TERM_PSI_B])*Math.sin(xy_term_sum);
        sum_epsilon += (PE_TERMS[i][TERM_EPS_C] + jce*PE_TERMS[i][TERM_EPS_D])*Math.cos(xy_term_sum);
    }

    del_psi     = sum_psi     / 36000000.0;
    del_epsilon = sum_epsilon / 36000000.0;

    return [del_psi, del_epsilon];
}

function ecliptic_mean_obliquity(jme: number) : number {
    const u = jme/10.0;

    return 84381.448 + u*(-4680.93 + u*(-1.55 + u*(1999.25 + u*(-51.38 + u*(-249.67 +
                       u*(  -39.05 + u*( 7.12 + u*(  27.87 + u*(  5.79 + u*2.45)))))))));
}

function ecliptic_true_obliquity(delta_epsilon: number, epsilon0: number) : number {
    return delta_epsilon + epsilon0/3600.0;
}

function aberration_correction(r: number) : number {
    return -20.4898 / (3600.0*r);
}

function apparent_sun_longitude(
    theta: number,
    delta_psi: number,
    delta_tau: number) : number
{
    return theta + delta_psi + delta_tau;
}

function greenwich_mean_sidereal_time (jd: number, jc: number) : number {
    return limit_degrees(280.46061837 + 360.98564736629 * (jd - 2451545.0) +
                                       jc*jc*(0.000387933 - jc/38710000.0));
}

function greenwich_sidereal_time (
    nu0: number,
    delta_psi: number,
    epsilon: number) : number
{
    return nu0 + delta_psi*Math.cos(deg2rad(epsilon));
}

function geocentric_right_ascension(
    lamda: number,
    epsilon: number,
    beta: number) : number
{
    const lamda_rad   = deg2rad(lamda);
    const epsilon_rad = deg2rad(epsilon);

    return limit_degrees(
        rad2deg(
            Math.atan2(
                Math.sin(lamda_rad)*Math.cos(epsilon_rad) - Math.tan(deg2rad(beta))*Math.sin(epsilon_rad),
                Math.cos(lamda_rad)
            )
        )
    );
}

function geocentric_declination(
    beta: number,
    epsilon: number,
    lamda: number) : number 
{
    const beta_rad    = deg2rad(beta);
    const epsilon_rad = deg2rad(epsilon);

    return rad2deg(
        Math.asin(
            Math.sin(beta_rad)*Math.cos(epsilon_rad) + Math.cos(beta_rad)*Math.sin(epsilon_rad)*Math.sin(deg2rad(lamda))
        )
    );
}

function observer_hour_angle(
    nu: number,
    longitude: number,
    alpha_deg: number) : number 
{
    return limit_degrees(nu + longitude - alpha_deg);
}

function sun_equatorial_horizontal_parallax(r: number) : number {
    return 8.794 / (3600.0 * r);
}

// Modification of delta_prime, delta_alpha reference params changed to return of tuple
function right_ascension_parallax_and_topocentric_dec(
    latitude: number,
    elevation: number,
    xi: number,
    h: number,
    delta: number,
    delta_alpha: number,
    delta_prime: number) : [number, number]
{
    const lat_rad   = deg2rad(latitude);
    const xi_rad    = deg2rad(xi);
    const h_rad     = deg2rad(h);
    const delta_rad = deg2rad(delta);
    const u = Math.atan(0.99664719 * Math.tan(lat_rad));
    const y = 0.99664719 * Math.sin(u) + elevation*Math.sin(lat_rad)/6378140.0;
    const x =              Math.cos(u) + elevation*Math.cos(lat_rad)/6378140.0;

    const delta_alpha_rad = Math.atan2(         - x*Math.sin(xi_rad) *Math.sin(h_rad),
                                Math.cos(delta_rad) - x*Math.sin(xi_rad) *Math.cos(h_rad));

    delta_prime = rad2deg( Math.atan2((Math.sin(delta_rad) - y*Math.sin(xi_rad))*Math.cos(delta_alpha_rad),
                                  Math.cos(delta_rad) - x*Math.sin(xi_rad) *Math.cos(h_rad)));

    delta_alpha = rad2deg(delta_alpha_rad);

    return [delta_alpha, delta_prime];
}

function topocentric_right_ascension(alpha_deg: number, delta_alpha: number) : number {
    return alpha_deg + delta_alpha;
}

function topocentric_local_hour_angle(h: number, delta_alpha: number) : number {
    return h - delta_alpha;
}

function topocentric_elevation_angle(
    latitude: number,
    delta_prime: number,
    h_prime: number) : number
{
    const lat_rad         = deg2rad(latitude);
    const delta_prime_rad = deg2rad(delta_prime);

    return rad2deg(Math.asin(Math.sin(lat_rad)*Math.sin(delta_prime_rad) +
                        Math.cos(lat_rad)*Math.cos(delta_prime_rad) * Math.cos(deg2rad(h_prime))));
}

function atmospheric_refraction_correction(
    pressure: number,
    temperature: number,
    atmos_refract: number,
    e0: number) : number
{
    let del_e = 0;

    if (e0 >= -1*(SUN_RADIUS + atmos_refract)) {
        del_e = (pressure / 1010.0) * (283.0 / (273.0 + temperature)) *
                 1.02 / (60.0 * Math.tan(deg2rad(e0 + 10.3/(e0 + 5.11))));
    }

    return del_e;
}

function topocentric_elevation_angle_corrected(e0: number, delta_e: number) : number {
    return e0 + delta_e;
}

function topocentric_zenith_angle(e: number) : number {
    return 90.0 - e;
}

function topocentric_azimuth_angle_astro(
    h_prime: number,
    latitude: number,
    delta_prime: number) : number
{
    const h_prime_rad = deg2rad(h_prime);
    const lat_rad     = deg2rad(latitude);

    return limit_degrees(rad2deg(Math.atan2(Math.sin(h_prime_rad),
                         Math.cos(h_prime_rad)*Math.sin(lat_rad) - Math.tan(deg2rad(delta_prime))*Math.cos(lat_rad))));
}

function topocentric_azimuth_angle(azimuth_astro: number) : number {
    return limit_degrees(azimuth_astro + 180.0);
}

function surface_incidence_angle(
    zenith: number,
    azimuth_astro: number,
    azm_rotation: number,
    slope: number) : number
{
    const zenith_rad = deg2rad(zenith);
    const slope_rad  = deg2rad(slope);

    return rad2deg(Math.acos(Math.cos(zenith_rad)*Math.cos(slope_rad)  +
                        Math.sin(slope_rad )*Math.sin(zenith_rad) * Math.cos(deg2rad(azimuth_astro - azm_rotation))));
}

function sun_mean_longitude(jme: number) : number {
    return limit_degrees(280.4664567 + jme*(360007.6982779 + jme*(0.03032028 +
                    jme*(1/49931.0   + jme*(-1/15300.0     + jme*(-1/2000000.0))))));
}

function eot(
    m: number,
    alpha: number,
    del_psi: number,
    epsilon: number) : number
{
    return limit_minutes(4.0*(m - 0.0057183 - alpha + del_psi*Math.cos(deg2rad(epsilon))));
}

function approx_sun_transit_time(
    alpha_zero: number,
    longitude: number,
    nu: number) : number
{
    return (alpha_zero - longitude - nu) / 360.0;
}

function sun_hour_angle_at_rise_set(
    latitude: number,
    delta_zero: number,
    h0_prime: number) : number
{
    let h0             = -99999;
    const latitude_rad   = deg2rad(latitude);
    const delta_zero_rad = deg2rad(delta_zero);
    const argument       = (Math.sin(deg2rad(h0_prime)) - Math.sin(latitude_rad)*Math.sin(delta_zero_rad)) /
                                                     (Math.cos(latitude_rad)*Math.cos(delta_zero_rad));

    if (Math.abs(argument) <= 1) h0 = limit_degrees180(rad2deg(Math.acos(argument)));

    return h0;
}

function approx_sun_rise_and_set(m_rts: number[], h0: number) : void {
    const h0_dfrac = h0/360.0;

    m_rts[SUN_RISE]    = limit_zero2one(m_rts[SUN_TRANSIT] - h0_dfrac);
    m_rts[SUN_SET]     = limit_zero2one(m_rts[SUN_TRANSIT] + h0_dfrac);
    m_rts[SUN_TRANSIT] = limit_zero2one(m_rts[SUN_TRANSIT]);
}

function rts_alpha_delta_prime(ad: number[], n: number) : number {
    let a = ad[JD_ZERO] - ad[JD_MINUS];
    let b = ad[JD_PLUS] - ad[JD_ZERO];

    if (Math.abs(a) >= 2.0) a = limit_zero2one(a);
    if (Math.abs(b) >= 2.0) b = limit_zero2one(b);

    return ad[JD_ZERO] + n * (a + b + (b-a)*n)/2.0;
}

function rts_sun_altitude(
    latitude: number,
    delta_prime: number,
    h_prime: number) : number
{
    const latitude_rad    = deg2rad(latitude);
    const delta_prime_rad = deg2rad(delta_prime);

    return rad2deg(Math.asin(Math.sin(latitude_rad)*Math.sin(delta_prime_rad) +
                        Math.cos(latitude_rad)*Math.cos(delta_prime_rad)*Math.cos(deg2rad(h_prime))));
}

function sun_rise_and_set(
    m_rts: number[],
    h_rts: number[],
    delta_prime: number[],
    latitude: number,
    h_prime: number[],
    h0_prime: number,
    sun: number) : number
{
    return m_rts[sun] + (h_rts[sun] - h0_prime) /
          (360.0*Math.cos(deg2rad(delta_prime[sun]))*Math.cos(deg2rad(latitude))*Math.sin(deg2rad(h_prime[sun])));
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Calculate required SPA parameters to get the right ascension (alpha) and declination (delta)
// Note: JD must be already calculated and in structure
////////////////////////////////////////////////////////////////////////////////////////////////
function calculate_geocentric_sun_right_ascension_and_declination(spa: SPA) : void {
    let x = new Array(TERM_X_COUNT);

    spa.jc = julian_century(spa.jd);

    spa.jde = julian_ephemeris_day(spa.jd, spa.delta_t);
    spa.jce = julian_ephemeris_century(spa.jde);
    spa.jme = julian_ephemeris_millennium(spa.jce);

    spa.l = earth_heliocentric_longitude(spa.jme);
    spa.b = earth_heliocentric_latitude(spa.jme);
    spa.r = earth_radius_vector(spa.jme);

    spa.theta = geocentric_longitude(spa.l);
    spa.beta  = geocentric_latitude(spa.b);

    x[TERM_X0] = spa.x0 = mean_elongation_moon_sun(spa.jce);
    x[TERM_X1] = spa.x1 = mean_anomaly_sun(spa.jce);
    x[TERM_X2] = spa.x2 = mean_anomaly_moon(spa.jce);
    x[TERM_X3] = spa.x3 = argument_latitude_moon(spa.jce);
    x[TERM_X4] = spa.x4 = ascending_longitude_moon(spa.jce);

    const [del_psi, del_eps] = nutation_longitude_and_obliquity(spa.jce, x, spa.del_psi, spa.del_epsilon);
    spa.del_psi = del_psi;
    spa.del_epsilon = del_eps;

    spa.epsilon0 = ecliptic_mean_obliquity(spa.jme);
    spa.epsilon  = ecliptic_true_obliquity(spa.del_epsilon, spa.epsilon0);

    spa.del_tau   = aberration_correction(spa.r);
    spa.lamda     = apparent_sun_longitude(spa.theta, spa.del_psi, spa.del_tau);
    spa.nu0       = greenwich_mean_sidereal_time (spa.jd, spa.jc);
    spa.nu        = greenwich_sidereal_time (spa.nu0, spa.del_psi, spa.epsilon);

    spa.alpha = geocentric_right_ascension(spa.lamda, spa.epsilon, spa.beta);
    spa.delta = geocentric_declination(spa.beta, spa.epsilon, spa.lamda);
}

////////////////////////////////////////////////////////////////////////
// Calculate Equation of Time (EOT) and Sun Rise, Transit, & Set (RTS)
////////////////////////////////////////////////////////////////////////

function calculate_eot_and_sun_rise_transit_set(spa: SPA) : void {
    let sun_rts = spa_alloc();

    let alpha = Array(JD_COUNT);
    let delta = Array(JD_COUNT);
    let m_rts = Array(SUN_COUNT);
    let nu_rts = Array(SUN_COUNT);
    let h_rts = Array(SUN_COUNT);
    let alpha_prime = Array(SUN_COUNT);
    let delta_prime = Array(SUN_COUNT);
    let h_prime = Array(SUN_COUNT);
    const h0_prime = -1*(SUN_RADIUS + spa.atmos_refract);

    Object.assign(sun_rts, spa);
    const m   = sun_mean_longitude(spa.jme);
    spa.eot = eot(m, spa.alpha, spa.del_psi, spa.epsilon);

    sun_rts.hour = sun_rts.minute = sun_rts.second = 0;
	sun_rts.delta_ut1 = sun_rts.timezone = 0.0;

    sun_rts.jd = julian_day (sun_rts.year,   sun_rts.month,  sun_rts.day,       sun_rts.hour,
		                     sun_rts.minute, sun_rts.second, sun_rts.delta_ut1, sun_rts.timezone);

    calculate_geocentric_sun_right_ascension_and_declination(sun_rts);
    const nu = sun_rts.nu;

    sun_rts.delta_t = 0;
    sun_rts.jd--;
    for (let i = 0; i < JD_COUNT; i++) {
        calculate_geocentric_sun_right_ascension_and_declination(sun_rts);
        alpha[i] = sun_rts.alpha;
        delta[i] = sun_rts.delta;
        sun_rts.jd++;
    }

    m_rts[SUN_TRANSIT] = approx_sun_transit_time(alpha[JD_ZERO], spa.longitude, nu);
    let h0 = sun_hour_angle_at_rise_set(spa.latitude, delta[JD_ZERO], h0_prime);

    if (h0 >= 0) {
        approx_sun_rise_and_set(m_rts, h0);

        for (let i = 0; i < SUN_COUNT; i++) {

            nu_rts[i]      = nu + 360.985647*m_rts[i];

            const n        = m_rts[i] + spa.delta_t/86400.0;
            alpha_prime[i] = rts_alpha_delta_prime(alpha, n);
            delta_prime[i] = rts_alpha_delta_prime(delta, n);

            h_prime[i]     = limit_degrees180pm(nu_rts[i] + spa.longitude - alpha_prime[i]);

            h_rts[i]       = rts_sun_altitude(spa.latitude, delta_prime[i], h_prime[i]);
        }

        spa.srha = h_prime[SUN_RISE];
        spa.ssha = h_prime[SUN_SET];
        spa.sta  = h_rts[SUN_TRANSIT];

        spa.suntransit = dayfrac_to_local_hr(m_rts[SUN_TRANSIT] - h_prime[SUN_TRANSIT] / 360.0,
                            spa.timezone);

        spa.sunrise = dayfrac_to_local_hr(sun_rise_and_set(m_rts, h_rts, delta_prime,
                        spa.latitude, h_prime, h0_prime, SUN_RISE), spa.timezone);

        spa.sunset  = dayfrac_to_local_hr(sun_rise_and_set(m_rts, h_rts, delta_prime,
                        spa.latitude, h_prime, h0_prime, SUN_SET),  spa.timezone);

    } else spa.srha = spa.ssha = spa.sta = spa.suntransit = spa.sunrise = spa.sunset = -99999;

}

///////////////////////////////////////////////////////////////////////////////////////////
// Calculate all SPA parameters and put into structure
// Note: All inputs values (listed in header file) must already be in structure
///////////////////////////////////////////////////////////////////////////////////////////
function spa_calculate(spa: SPA) : number {
    let result = validate_inputs(spa);

    if (result == 0)
    {
        spa.jd = julian_day (spa.year, spa.month, spa.day, spa.hour, spa.minute, spa.second,
            spa.delta_ut1, spa.timezone);

        calculate_geocentric_sun_right_ascension_and_declination(spa);

        spa.h  = observer_hour_angle(spa.nu, spa.longitude, spa.alpha);
        spa.xi = sun_equatorial_horizontal_parallax(spa.r);

        const [da, dp] = right_ascension_parallax_and_topocentric_dec(
                            spa.latitude, spa.elevation, spa.xi,
                            spa.h, spa.delta, spa.del_alpha, spa.delta_prime);

        spa.del_alpha = da;
        spa.delta_prime = dp;

        spa.alpha_prime = topocentric_right_ascension(spa.alpha, spa.del_alpha);
        spa.h_prime     = topocentric_local_hour_angle(spa.h, spa.del_alpha);

        spa.e0    = topocentric_elevation_angle(spa.latitude, spa.delta_prime, spa.h_prime);
        spa.del_e = atmospheric_refraction_correction(spa.pressure, spa.temperature, spa.atmos_refract, spa.e0);
        spa.e     = topocentric_elevation_angle_corrected(spa.e0, spa.del_e);

        spa.zenith        = topocentric_zenith_angle(spa.e);
        spa.azimuth_astro = topocentric_azimuth_angle_astro(spa.h_prime, spa.latitude, spa.delta_prime);
        spa.azimuth       = topocentric_azimuth_angle(spa.azimuth_astro);

        if ((spa.function == CalculateWhat.ZenithAzimuthIncidence) ||
            (spa.function == CalculateWhat.All)) {
            spa.incidence  = surface_incidence_angle(spa.zenith, spa.azimuth_astro, spa.azm_rotation, spa.slope);
        }

        if ((spa.function == CalculateWhat.ZenithAzimuthSun) ||
            (spa.function == CalculateWhat.All)) {
            calculate_eot_and_sun_rise_transit_set(spa);
        }
    }

    return result;
}
///////////////////////////////////////////////////////////////////////////////////////////

// Used for HH[sep]MM[sep]SS format time strings. Can also be used for
// dates, e.g. YYYY[sep]MM[sep]DD.
function timeStr(
    a: number,
    b: number,
    c: number,
    sep:string = ':') : string
{
	// Pad with leading zero, if would otherwise be single character
	function iiStr(i: number) : string {
		let s = `${Math.floor(i).toFixed(0)}`;
		return (s.length == 1) ? `0${s}` : s;
	}

	return `${iiStr(a)}${sep}${iiStr(b)}${sep}${iiStr(c)}`;
}

function spa_print(spa: SPA) : string[] {
	let int = Math.floor;

	let sunrise, sunset, transit;

	{
		let hour = spa.sunrise;
		let min = 60.0*(spa.sunrise - int(spa.sunrise));
		let sec = 60.0*(min - int(min));
		sunrise = `  Sunrise:       ${timeStr(hour, min, sec)} Local`;
	}

	{
		let hour = spa.sunset;
		let min = 60.0*(spa.sunset - int(spa.sunset));
		let sec = 60.0*(min - int(min));
		sunset = `  Sunset:        ${timeStr(hour, min, sec)} Local`;
	}

	{
		let hour = spa.suntransit;
		let min = 60.0*(spa.suntransit - int(spa.suntransit));
		let sec = 60.0*(min - int(min));
		transit = `  Transit:       ${timeStr(hour, min, sec)} Local`;
	}

	return [
		'Inputs:',
		'',
		`  ${timeStr(spa.year,spa.month,spa.day,'/')} ${timeStr(spa.hour,spa.minute,spa.second)} GMT ${spa.timezone}`,
		'',
		`  Latitude:      ${(spa.latitude).toFixed(2)}`,
		`  Longitude:     ${(spa.longitude).toFixed(2)}`,
		`  Elevation:     ${(spa.elevation).toFixed(2)}`,
		`  Pressure:      ${(spa.pressure).toFixed(2)}`,
		`  Temperature:   ${(spa.temperature).toFixed(2)}`,
		'',
		`  DeltaUT1:      ${(spa.delta_ut1).toFixed(2)}`,
		`  DeltaT:        ${(spa.delta_t).toFixed(2)}`,
		`  Slope:         ${(spa.slope).toFixed(2)}`,
		`  Azm rotation:  ${(spa.azm_rotation).toFixed(2)}`,
		`  Atmos refract: ${(spa.atmos_refract).toFixed(2)}`,
		'',
		'Outputs:',
		'',
		`  Zenith:        ${(spa.zenith).toFixed(2)} degrees`,
		`  Azimuth:       ${(spa.azimuth).toFixed(2)} degrees`,
		`  Incidence:     ${(spa.incidence).toFixed(2)} degrees`,
		'',
		sunrise,
		sunset,
		transit,
	];
}

// Functionality copied from original spa_tester.c
function spa_test() : void {
	/////////////////////////////////////////////
	//          SPA TESTER for SPA.C           //
	//                                         //
	//      Solar Position Algorithm (SPA)     //
	//                   for                   //
	//        Solar Radiation Application      //
	//                                         //
	//             August 12, 2004             //
	//                                         //
	//   Filename: SPA_TESTER.C                //
	//                                         //
	//   Afshin Michael Andreas                //
	//   afshin_andreas@nrel.gov (303)384-6383 //
	//                                         //
	//   Measurement & Instrumentation Team    //
	//   Solar Radiation Research Laboratory   //
	//   National Renewable Energy Laboratory  //
	//   1617 Cole Blvd, Golden, CO 80401      //
	/////////////////////////////////////////////

	/////////////////////////////////////////////
	// This sample program shows how to use    //
	//    the SPA.C code.                      //
	/////////////////////////////////////////////

	//enter required input values into SPA structure

    let spa = spa_alloc();

	spa.year          = 2003;
	spa.month         = 10;
	spa.day           = 17;

	spa.hour          = 12;
	spa.minute        = 30;
	spa.second        = 30;

	spa.timezone      = -7.0;

	spa.delta_ut1     = 0;
	spa.delta_t       = 67;

	spa.longitude     = -105.1786;
	spa.latitude      = 39.742476;
	spa.elevation     = 1830.14;
	spa.pressure      = 820;
	spa.temperature   = 11;

	spa.slope         = 30;
	spa.azm_rotation  = -10;
	spa.atmos_refract = 0.5667;
    spa.function      = CalculateWhat.All;
;

	//call the SPA calculate function and pass the SPA structure

	let result = spa_calculate(spa);

	if (result == 0) {
        let lines = spa_print(spa);
        for (let line of lines) console.log(line);
    }
	else console.log(`SPA Error Code: ${result}`);
}
