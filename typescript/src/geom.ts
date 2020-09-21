/*
    JavaScript geometry utility routines.
    John Grime, Emerging Technologies Team, University of Oklahoma Libraries.
*/

// Strict mode automatic if loaded as a module, but it may not have been ...
"use strict";

export {
	dot,
	cross,
	unit,

	rotate,

	convertLatLon,
	convertAziZen,
	convertAll,
};


// ***************************
// * Basic geometry routines *
// ***************************


function dot( u: number[], v: number[]) : number
{
	return u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
}

function cross( u: number[], v: number[]) : number[]
{
	const [ux, uy, uz] = u;
	const [vx, vy, vz] = v;
	return [(uy*vz)-(uz*vy), (uz*vx)-(ux*vz), (ux*vy)-(uy*vx)];
}

function unit(v: number[]) : number[]
{
	const L = Math.sqrt(dot(v,v));
	return [v[0]/L, v[1]/L, v[2]/L];
}

/*
	Rotate set of points "xyz_vec" = [ [x,y,z], [x,,z], ... ] by theta radians
	around the vector "axis" that passes through location "point".
*/
function rotate(
	xyz_vec: number[][],
	theta: number,
	axis: number[],
	point: number[] = [0,0,0]) : number[][]
{
	let results = [];

	const [a,b,c] = point;

	const ct = Math.cos(theta);
	const st = Math.sin(theta);

	const [u,v,w] = axis;
	const u2 = u*u, v2 = v*v, w2 = w*w;

	const K = u2 + v2 + w2;
	const L = Math.sqrt(K);

	for (let i=0; i<xyz_vec.length; i++) {
		let [x,y,z] = xyz_vec[i];

		let rx = a * (v2+w2)
			+ u * (-b*v -c*w + u*x + v*y + w*z)
			+ ((x-a)*(v2+w2) + u*(b*v + c*w - v*y - w*z)) * ct
			+ L * (b*w - c*v - w*y + v*z) * st;

		let ry = b * (u2+w2)
			+ v * (-a*u -c*w + u*x + v*y + w*z)
			+ ((y-b)*(u2+w2) + v*(a*u + c*w - u*x - w*z)) * ct
			+ L * (-a*w + c*u + w*x - u*z) * st;

		let rz = c * (u2+v2)
			+ w * (-a*u -b*v + u*x + v*y + w*z)
			+ ((z-c)*(u2+v2) + w*(a*u + b*v - u*x - v*y)) * ct
			+ L * (a*v - b*u - v*x + u*y) * st;

		results.push( [rx/K+a, ry/K+b, rz/K+c] );
	}

	return results;
}


// ********************************************************
// * Geometry routines specific to earth/sun calculations *
// ********************************************************


/*
	Given a location (x,y,z) on unit sphere, return local axis vectors.
	Here, +x axis = east, +y axis = up/elevation, +z axis = north.

	y vector is normal to sphere surface (via specified x,y,z position), so
	estimate z direction as unit vector from specified x,y,z to north pole.
	Then generate x direction from cross product of y and z estimate.
	Finally, generate true z direction as cross of y and x vectors.
*/
function getLocalAxes(
	x: number,
	y: number,
	z: number): number[][]
{
	const npole = [0,1,0];      // assumes north pole at [0,1,0] in GLOBAL coords
	const yhat = unit([x,y,z]); // normal to sphere surface at xyz is xyz/|xyz|
	const ct = dot(yhat,npole); // cos(theta) ~ +1/-1 when theta ~ 0 or 180

	// At north or south pole? Arbitrary xhat, so arbitrary zhat.
	// See note in convertAll() if you're going to use the local axes to
	// calculate sun position from azimuth and zenith.
	if ((1.0-ct*ct) < 1e-10) {
		const xhat = [1,0,0], zhat = unit(cross(xhat,yhat));
		return [xhat, yhat, zhat];
	}

	const _zhat = unit([npole[0]-x, npole[1]-y, npole[0]-z]); // zhat estimate
	const xhat = unit(cross(yhat,_zhat));
	const zhat = unit(cross(xhat,yhat)); // actual zhat
	return [xhat, yhat, zhat];
}

/*
	Convert latitude and longitude (in degrees) to data on the unit sphere.

	latitude: [-90,+90]. Equator = 0, south pole = -90, north pole = +90,
	longitude: [-180,+180]. Greenwich = 0, west -ve, east +ve.

	Returns x,y,z coords of point on unit sphere corresponding to the
	specified latitude and longitude, along with the y location and radius
	of the latitude "ring" on the x,z plane.

	Here we assume global y axis connects south pole to north pole, global z
	axis points out through lat,lon = 0,0, global x axis points "east-y".
*/
function convertLatLon(
	lat_degs: number,
	lon_degs: number) : number[]
{
	const r = 1.0;
	const theta = lat_degs/180.0 * Math.PI;
	const phi   = lon_degs/180.0 * Math.PI;

	const lat_ring_r = r * Math.cos(theta);
	const lat_ring_y = r * Math.sin(theta);

	let y = lat_ring_y;
	let x = lat_ring_r * Math.sin(-phi);
	let z = lat_ring_r * Math.cos(-phi);

	return [x,y,z, lat_ring_y,lat_ring_r];
}

/*
	Given local coordinate axes, calculate effective direction vector specified
	by azimuthal angle (clockwise from north to east) and zenith (deviation
	from "up", converted into rotation out of ground plane for ease of use).

	Here, x is east, y is up, and z is north.
*/
function convertAziZen(
	ax: number[],
	ay: number[],
	az: number[],
	azi_degs: number,
	zen_degs: number) : number[]
{
	let r = [az[0],az[1],az[2]];
	[r]   = rotate([r], azi_degs/180.0 * Math.PI, ay);

	// convert zenith (measured from vertical) into elevation (measured from
	// horizontal) for out-of-ground-plane rotation.
	let elevation_rads = (90.0-zen_degs)/180.0 * Math.PI;
	let axis = unit( cross(r,ay) );
	[r] = rotate([r], elevation_rads, axis);

	return [r[0], r[1], r[2]];
}

/*
	Given latitude,longitude and azimuth,zenith angle pairs, return
	the location on the unit sphere along with the local axis vectors
	and vector describing the direction towards the sun.

	Note: At the north pole, all directions are south and so the usual N/E/S/W
	relationships break down. Something similar happens at the south pole.
	While we could choose arbitrary north/south and east/west vectors at the
	north and south poles (perhaps the global x and z axes), this causes
	problems where we use the local axes to e.g. calculate sun position from
	azimuth and zenith angles: the zenith angle remains well defined (up is
	always normal to the sphere surface), but the azimuth requires north and
	east to be defined. This can lead to the sun location "jumping around" for
	latitude 90 or -90 vs e.g. 89.99 or -89.99.

	To remedy this, note that for a given longitude the east/west direction
	vector remains the same, regardless of latitude (i.e., only the north/south
	and "up" vectors change). We can therefore calculate the local east/west
	direction vector at the equator for the specified longitude, and infer the
	north/south vector as the cross of "up" (always well defined) and the
	east/west vector from the equator.

	Here, x,y,z axis vectors correspond to west,up,north directions.
*/
function convertAll(
	lat_degs: number,
	lon_degs: number,
	azi_degs: number,
	zen_degs: number) : [number[], number[], number[], number[], number[]]
{
	const limit = 90.0 - 1e-3;
	let ax,ay,az;
	let [x,y,z,,] = convertLatLon(lat_degs, lon_degs);		

	// Polar check - see note above.
	if (Math.abs(lat_degs) >= limit) {
		// Determine local x axis vector (ax) at equator for this longitude.
		let [x_,y_,z_,,] = convertLatLon(0, lon_degs);		
		[ax, ay, az] = getLocalAxes(x_,y_,z_);

		// Local axis vectors (ay,az) consistent with ax form equator
		ay = unit( [x,y,z] );
		az = unit( cross(ax,ay) );
	} else {
		[ax, ay, az] = getLocalAxes(x,y,z);
	}

	const sun_dir = convertAziZen(ax,ay,az, azi_degs, zen_degs);

	// [x,y,z] : location on surface of unit sphere
	// ax, ay, az : local axis vectors
	// sun_dir : apparent direction to sun location from [x,y,z]
	return [ [x,y,z], ax, ay, az, sun_dir ];
}
