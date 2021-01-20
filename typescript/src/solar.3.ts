import * as SPA  from './spa.js';
import * as GEOM from './geom.js';
import * as UI   from './ui.js';

// Handled in tsconfig.json, e.g.: "types": ["babylonjs"]
//import * as BABYLON from 'babylonjs';


/*
	**********************************************
	Define some constants and types.
	**********************************************
*/

// From model generation parameters.

const lon0 = -107.95972;
const lat0 = 36.06069;

const lon_m_per_deg = 89889.30427959062;
const lat_m_per_deg = 111194.92664455873;

function lonlat_degs_to_m(lon: number, lat: number): [number,number] {
	return [ (lon-lon0)*lon_m_per_deg, (lat-lat0)*lat_m_per_deg ];
}

// hour, minute, second <=> decimal hour

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

// hour, minute, second <=> seconds

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

// https://gist.github.com/paulkaplan/5184275
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

//
// Solstace / equinox calculations.
// Based on: https://phabricator.kde.org/R175:55e1d14fe900a5ac1acd3a76dfa51f8ccfa67b21
//

enum Season {
	MarchEquinox,
	JuneSolstice,
	SeptemberEquinox,
	DecemberSolstice,
}

function meanJDE(season: Season, year: number): number {
	if (year <= 1000) {
		// Astronomical Algorithms, Jean Meeus, chapter 26, table 26.A
		// mean season Julian dates for years -1000 to 1000
		const y = year / 1000.0;
		switch (season) {
			case Season.MarchEquinox:
			return 1721139.29189 + (365242.13740 * y) + (0.06134 * Math.pow(y, 2)) + (0.00111 * Math.pow(y, 3)) - (0.00071 * Math.pow(y, 4));

			case Season.JuneSolstice:
			return 1721233.25401 + (365241.72562 * y) - (0.05323 * Math.pow(y, 2)) + (0.00907 * Math.pow(y, 3)) + (0.00025 * Math.pow(y, 4));

			case Season.SeptemberEquinox:
			return 1721325.70455 + (365242.49558 * y) - (0.11677 * Math.pow(y, 2)) - (0.00297 * Math.pow(y, 3)) + (0.00074 * Math.pow(y, 4));

			case Season.DecemberSolstice:
			return 1721414.39987 + (365242.88257 * y) - (0.00769 * Math.pow(y, 2)) - (0.00933 * Math.pow(y, 3)) - (0.00006 * Math.pow(y, 4));

			default:
			return 0;
		}
	} else {
		// Astronomical Algorithms, Jean Meeus, chapter 26, table 26.B
		// mean season Julian dates for years 1000 to 3000
		const y = (year - 2000) / 1000.0;
		switch (season) {
			case Season.MarchEquinox:
			return 2451623.80984 + (365242.37404 * y) + (0.05169 * Math.pow(y, 2)) - (0.00411 * Math.pow(y, 3)) - (0.00057 * Math.pow(y, 4));

			case Season.JuneSolstice:
			return 2451716.56767 + (365241.62603 * y) + (0.00325 * Math.pow(y, 2)) + (0.00888 * Math.pow(y, 3)) - (0.00030 * Math.pow(y, 4));

			case Season.SeptemberEquinox:
			return 2451810.21715 + (365242.01767 * y) - (0.11575 * Math.pow(y, 2)) + (0.00337 * Math.pow(y, 3)) + (0.00078 * Math.pow(y, 4));

			case Season.DecemberSolstice:
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


// Bit flags
const RenderFlags = {
	Ignore: 0,
	Once:   1,
	Loop:   2,
};

// A BabylonJS 3D view
type View = {
	ready: boolean;
	shouldRender: number;

	engine: any;
	scene : any;
	camera: any;
	light : any;

	objects: { [key: string]: any };
};

// A named position; lat/lon are [degs,mins.secs]
type Waypoint = {
	name: string;
	lat: number[];
	lon: number[];
};

type DynamicColors = {
	K0: number; // min color temp, Kelvin
	K1: number; // max color temp, Kelvin

	ambient0: number; // min ambient intensity
	ambient1: number; // max ambient intensity

	skyblue0: BABYLON.Color3; // blue of sky at night
	skyblue1: BABYLON.Color3; // blue of sky at midday
};

class UIValue {
	load_cb: () => void;
	store_cb: () => void;

	constructor(load_cb: () => void, store_cb: () => void) {
		this.load_cb = load_cb;
		this.store_cb = store_cb;
	}

	load() {
		this.load_cb?.();
	}

	store() {
		this.store_cb?.();
	}
}

// Storage type for system data
type systemData = {
	refreshUI:    () => void;
	refreshSPA:   () => void;
	refreshViews: () => void;

	spa: SPA.SPA,

	globalView: View;
	localView: View;

	local_sun_distance: number;
	local_sun_radius: number;
	local_models: string[];
	local_marker?: BABYLON.Mesh;
	local_waypoints: Waypoint[];

	dynamic_colors: DynamicColors;
	ambient_light?: BABYLON.HemisphericLight;

	ui_values: UIValue[];
};


/*
	**********************************************
	Central repository for all system data.
	**********************************************
*/


let systemData: systemData = {

	// Routines to move SPA data in/out of GUI, and update views
	refreshUI:    function () { console.log('refreshUI() missing'); },
	refreshSPA:   function () { console.log('refreshSPA() missing'); },
	refreshViews: function () { console.log('refreshViews() missing'); },

	// Solar calculation data structure
	spa: SPA.alloc(),

	// View of the globe
	globalView: {
		ready: false,
		shouldRender: RenderFlags.Ignore,

		engine: null,
		scene : null,
		camera: null,
		light : null,

		objects: {
			location: null, // location indicator
			sphere:   null, // light position indicator
		},
	},

	// View of the local environment
	localView: {
		ready: false,
		shouldRender: RenderFlags.Ignore,

		engine: null,
		scene : null,
		camera: null,
		light : null,

		objects: {
			sphere: null, // light position indicator
			scenery: null,
		}
	},

	local_sun_distance: 25000.0,
	local_sun_radius: 500.0,

	local_models: [
		"./models/model_20/",
		"./models/model_19/",
		"./models/model_18/",
		"./models/model_17/",
		"./models/model_16/",
		"./models/model_15/",
	],

	local_marker: undefined,

	local_waypoints: [
		{
			name: "Pueblo Bonito",
			lat: [ 36 ,  3, 39],
			lon: [-107, 57, 44],
		},
		{
			name: "Pueblo Bonito",
			lat: [ 36 ,  3, 39],
			lon: [-107, 57, 42],
		},
		{
			name: "Hillside Ruin",
			lat: [ 36 , 3 , 38],
			lon: [-107, 57, 35],
		},
		{
			name: "Chetro Ketl",
			lat: [ 36 , 3 , 37],
			lon: [-107, 57, 15],
		},
		{
			name: "McElmo Unit",
			lat: [ 36 , 3 , 36],
			lon: [-107, 57, 19],
		},
		{
			name: "Pueblo Del Arroyo",
			lat: [ 36 , 3 , 40],
			lon: [-107, 57, 56],
		},
	],

	dynamic_colors: {
		K0: 1800,
		K1: 16000,

		ambient0: 0.2,
		ambient1: 1.0,

		skyblue0: new BABYLON.Color3(0.027, 0.086, 0.20),
		skyblue1: new BABYLON.Color3(0.48, 0.67, 0.86),
	},

	ambient_light: undefined,

	ui_values: [],
};


/*
	**********************************************
	Misc. graphics functions.
	**********************************************
*/


function BV3(v: number[]) : BABYLON.Vector3 {
	return new BABYLON.Vector3(v[0], v[1], v[2]);
}

// Draw axes from xhat, yhat, zhat vectors at origin of length L.
function drawAxes(
	origin: number[],
	xhat: number[],
	yhat: number[],
	zhat: number[],
	L: number,
	scene: any ) : BABYLON.LinesMesh[]
{
	let x: number[] = [], y: number[] = [], z: number[] = [];

	for (let i=0; i<3; i++) {
		x.push(origin[i] + xhat[i]*L);
		y.push(origin[i] + yhat[i]*L);
		z.push(origin[i] + zhat[i]*L);
	}

	const [vo,vx,vy,vz] = [BV3(origin),BV3(x),BV3(y),BV3(z)];

	let axisX = BABYLON.Mesh.CreateLines("axisX", [vo,vx], scene);
	axisX.color = new BABYLON.Color3(1,0,0);

	let axisY = BABYLON.Mesh.CreateLines("axisY", [vo,vy], scene);
	axisY.color = new BABYLON.Color3(0,1,0);

	let axisZ = BABYLON.Mesh.CreateLines("axisZ", [vo,vz], scene);
	axisZ.color = new BABYLON.Color3(0,0,1);

	return [axisX, axisY, axisZ];
};	

// Draw small sphere with local axes at specified latitude and longitude, and the sun
// dirction vector specified by azimuth and zenith angles.
function drawMarker(
	lat_degs: number,
	lon_degs: number,
	azi_degs: number,
	zen_degs: number,
	sphere_params: any,
	scene: any): [BABYLON.Mesh, BABYLON.LinesMesh, BABYLON.LinesMesh, BABYLON.LinesMesh]
{
	let [pos, xhat, yhat, zhat, sun] = GEOM.convertAll(lat_degs,lon_degs, azi_degs,zen_degs);
	
	const [x,y,z] = pos;
	const hat = GEOM.unit(pos);
	const r = sphere_params.diameter/2;
	const pos_ = [x + hat[0]*r, y + hat[1]*r, z + hat[2]*r];

	// Sphere marker

	let sphere = BABYLON.MeshBuilder.CreateSphere('sphere', sphere_params, scene);
	sphere.position = BV3(pos);

	// Local axes

	const [ax,ay,az] = drawAxes(pos_, xhat, yhat, zhat, r*2, scene);

	return [sphere, ax, ay, az];
}


/*
	**********************************************
	Scene setup.
	**********************************************
*/


function createView(canvas: HTMLCanvasElement) : [BABYLON.Engine, BABYLON.Scene, BABYLON.ArcRotateCamera] {
	let engine = new BABYLON.Engine(canvas, true);
	let scene = new BABYLON.Scene(engine);
	let camera = new BABYLON.ArcRotateCamera('camera', 0,0,0, BV3([0,0,0]), scene);
	camera.attachControl(canvas, false);
	return [engine, scene, camera];
}

function populateGlobalView(canvas: HTMLCanvasElement) {
	let [engine, scene, camera] = createView(canvas);
	let light: any, sphere: any; // FIXME

	scene.clearColor = new BABYLON.Color4(0,0,0,1);
	
	// Light
	{
		light = new BABYLON.PointLight('light1', new BABYLON.Vector3(0,1,0), scene);
		light.intensity = 50.0;
		light.fallofftype = BABYLON.Light.FALLOFF_GLTF;
	}

	// Camera
	{
		camera.position = BV3([0,0,5]);
		camera.lowerRadiusLimit = 2.0;
	}

	// Populate scene
	{
	
		let matEarth: any = new BABYLON.StandardMaterial("matEarth", scene); // FIXME
		{
			const c = new BABYLON.Color4(0.1, 0.1, 0.1);
			matEarth.diffuseColor = c;
			matEarth.specularColor = new BABYLON.Color4(0,0,0);
			matEarth.ambientColor = c;

			const path = '2k_earth_daymap.jpg';
			let tex = new BABYLON.Texture(path, scene);
			tex.onLoadObservable.addOnce( function() {
				console.log('Globe texture loaded.');
				systemData.refreshViews();
			});
			tex.vScale = -1;
			tex.uScale = -1;
			tex.uOffset = 0.252; // align texture so lat,lon values are at expected point

			for (let x of ['diffuse']) {
				matEarth[`${x}Texture`] = tex;
			}
		}

		let matLatitude: any = new BABYLON.StandardMaterial("matLat", scene); // FIXME
		{
			const c = new BABYLON.Color4(1, 0.2, 0);
			matLatitude.emissiveColor = c; // required for glow layer
			matLatitude.ambientColor = c;
		}

		let matLongitude: any = new BABYLON.StandardMaterial("matLong", scene); // FIXME
		{
			const c = new BABYLON.Color4(0, 1, 0.2);
			matLongitude.emissiveColor = c; // required for glow layer
			matLongitude.ambientColor = c;    	
		}

		let matSun: any = new BABYLON.StandardMaterial("matSun", scene); // FIXME
		{
			const c = new BABYLON.Color4(0.921, 0.753, 0.204);
			matSun.emissiveColor = c; // required for glow layer
			matSun.ambientColor = c;
		}

		// Earth
		{
			let earth_sphere = BABYLON.MeshBuilder.CreateSphere('sphere', {segments:16, diameter:2}, scene);
			earth_sphere.material = matEarth;
		}

		// Sun indicator
		{
			sphere = BABYLON.MeshBuilder.CreateSphere('sphere', {segments:16, diameter:2}, scene);
			sphere.material = matSun;
		}

		// Glow layer for sun
		let gl = new BABYLON.GlowLayer("glow", scene);
		gl.intensity = 0.5;

		// Add latitude / longitude markers
		{
			const [thickness, tesselation] = [0.0025, 64];
			const r = 1.0, scale = 1.01; // ensure rings slightly above sphere surface
			let params = {
				diameter: 1.0, // overridden later
				thickness: thickness,
				tessellation: tesselation,
			};

			let gl = new BABYLON.GlowLayer("glow", scene);
			gl.intensity = 0.5;

			// Latitudinal/longitudinal rings around globe
			{
				const N = 11;
				for (let i=0; i<N; i++) {
					const u = (1.0/N) * (0.5+i);
					const degs = -90.0 + u*180.0;
					const [x,y,z, ring_y,ring_r] = GEOM.convertLatLon(degs, 0);

					params.diameter = (2.0*ring_r) * scale;
					let torus = BABYLON.MeshBuilder.CreateTorus("torus", params, scene);
					torus.position.y = ring_y * scale;
					torus.material = matLatitude;
				}
			}
			{
				const N = 8;
				for (let i=0; i<N; i++) {
					const u = (1.0/N) * i;
					const rads = u*Math.PI;

					params.diameter = (2.0*r) * scale;
					let torus = BABYLON.MeshBuilder.CreateTorus("torus", params, scene);
					torus.rotation.z = Math.PI/2.0;
					torus.rotation.y = rads;
					torus.material = matLongitude;
				}
			}
		}
	}

	// Add objects to system data
	{
		systemData.globalView.engine = engine;
		systemData.globalView.scene = scene;
		systemData.globalView.camera = camera;
		systemData.globalView.light = light;
		systemData.globalView.objects.sphere = sphere;
	}

	systemData.globalView.shouldRender |= RenderFlags.Once;
	systemData.globalView.ready = true;
}

function populateLocalView(canvas: HTMLCanvasElement) {
	let [engine, scene, camera] = createView(canvas);
	let light: any, sphere: any; // FIXME
	
	// Directional light
	{
		let light_pos = [1,1,1];
		let light_dir = GEOM.unit([0-light_pos[0], 0-light_pos[1], 0-light_pos[2]]);
		light = new BABYLON.DirectionalLight('light1', BV3(light_dir), scene);
		light.position = BV3(light_pos);
	}

	// Hemispheric light for ambient; change color/intensity with sunrise/sunset?
	{
		let ambient = new BABYLON.HemisphericLight('hemi_light1', BV3([0,1,0]), scene);
		ambient.intensity = 0.2;
		systemData.ambient_light = ambient;
	}

	// Camera
	{
		camera.position = BV3([-4,4,0]);
		camera.lowerRadiusLimit = 0;
		camera.minZ = 0.1;
		camera.maxZ = 100000;
	}

	// Populate scene
	{
		let shadowGenerator;

		// Set up some light effects
		{
			// Glow layer for sun
			let gl = new BABYLON.GlowLayer("glow", scene);
			gl.intensity = 0.5;

			// Shadows
	//		const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
			shadowGenerator = new BABYLON.ShadowGenerator(4096, light);
	//		const shadowGenerator = new BABYLON.ShadowGenerator(40960, light);
	//		const shadowGenerator = new BABYLON.CascadedShadowGenerator(4096, light);
	
//			shadowGenerator.useBlurExponentialShadowMap = true;
//			shadowGenerator.useKernelBlur = true;
//			shadowGenerator.blurKernel = 64;
	
	//		shadowGenerator.useBlurCloseExponentialShadowMap = true;
		}

		// local sun
		{
			let matSun: any = new BABYLON.StandardMaterial("matSun", scene); // FIXME
			const c = new BABYLON.Color4(0.921, 0.753, 0.204);
			matSun.emissiveColor = c; // required for glow layer
			matSun.ambientColor = c;

			sphere = BABYLON.MeshBuilder.CreateSphere('sphere', {diameter: systemData.local_sun_radius*2}, scene);
			sphere.position = BV3([1,1,1]);
			sphere.material = matSun;
		}

		// local marker
		{
			let parentObject = new BABYLON.Mesh("local_marker", scene);

			// Local axes
			let [axisX,axisY,axisZ] = drawAxes([0,0,0], [1,0,0], [0,1,0], [0,0,1], 1.5, scene);
			axisX.setParent(parentObject);
			axisY.setParent(parentObject);
			axisZ.setParent(parentObject);

			// Basic scene components
			const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 1, height: 1}, scene);
			ground.receiveShadows = true;
			ground.setParent(parentObject);

			const cyl = BABYLON.MeshBuilder.CreateCylinder("cyl", {height: 1, diameter: 0.1}, scene);
			cyl.position = BV3([0,0.5,0]);
			cyl.setParent(parentObject);

			shadowGenerator.addShadowCaster(cyl);

			systemData.local_marker = parentObject;
		}

		// Load local models
		for (let local_path of systemData.local_models) {

			BABYLON.SceneLoader.ImportMesh(null, local_path, "out.obj", scene,
				function onSuccess(meshes, particleSystems, skeletons) {
					console.log(`success! ${meshes.length}`);
					let m = meshes[0];

					m.receiveShadows = true;

					// We likely don't have vertex normals in the file to save space. Calculate them here.
					let vtx = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
					if (vtx != null) {
						let nrm = new Float32Array(vtx.length);
						BABYLON.VertexData.ComputeNormals(vtx, m.getIndices(), nrm);
						m.setVerticesData(BABYLON.VertexBuffer.NormalKind, nrm);
					}

					systemData.localView.objects.scenery = m;

					systemData.refreshViews();
				},
				function onProgress(scene) {
					console.log("progress!");
				},
				function onError(scene) {
					console.log("error!");
				}
			);
		}
	}

	// Add objects to system data
	{
		systemData.localView.engine = engine;
		systemData.localView.scene = scene;
		systemData.localView.camera = camera;
		systemData.localView.light = light;
		
		systemData.localView.objects.sphere = sphere;
	}

	systemData.localView.shouldRender |= RenderFlags.Once;
	systemData.localView.ready = true;
}


/*
	**********************************************
	System update functions.
	**********************************************
*/


systemData.refreshViews = function() {
	let spa: any =  systemData.spa; // FIXME

	systemData.refreshSPA();

	let result = SPA.calculate(systemData.spa);
	
	// Update output text region
	if (result == 0) {
		let lines = SPA.print(spa);
		let outContainer = document.getElementById('outputContainer');
		if (outContainer !== null) {
			let txt = '';
			outContainer.innerHTML = '';
			for (let line of lines) {
				txt += `${line}<br>`;
			}
			outContainer.innerHTML = txt;
		} else {
			for (let line of lines) {
				console.log(line);
			}
		}
	}
	else {
		console.log(`SPA Error Code: ${result}`);
	}

	const { latitude, longitude, azimuth, zenith } = spa;

	// Update global view
	if (systemData.globalView.ready)
	{
		const params = {segments:16, diameter:0.05};
		let { light, camera, scene } = systemData.globalView;
		let [sphere, ax,ay,az] = drawMarker(latitude,longitude, azimuth,zenith, params, scene);

		let parent = new BABYLON.TransformNode("root");

		// Ensure parent position is appropriate origin for children
		parent.position = BV3([sphere.position.x,sphere.position.y,sphere.position.z]);

		// use setParent(), as adjusts child.position relative to parent
		sphere.setParent(parent);
		ax.setParent(parent);
		ay.setParent(parent);
		az.setParent(parent);

		if (systemData.globalView.objects.location !== null) {
			systemData.globalView.objects.location.dispose();
			systemData.globalView.objects.location = null;			
		}

		systemData.globalView.objects.location = parent;

		// Re-target camera
		{
			let p = parent.position;
			let r = 3;
			let [x,y,z] = GEOM.unit([p.x,p.y,p.z]);
			camera.setPosition( BV3([x*r,y*r,z*r]) );
		}

		// Move light and "sun".
		{
			let [ [x,y,z], ax, ay, az, sun_dir] = GEOM.convertAll(latitude, longitude, azimuth, zenith);
			let [light_dist, sun_dist] = [2.0, 50.0];
			let sphere = systemData.globalView.objects.sphere;

			light.position.x = x + sun_dir[0]*light_dist;
			light.position.y = y + sun_dir[1]*light_dist;
			light.position.z = z + sun_dir[2]*light_dist;

			sphere.position.x = x + sun_dir[0]*sun_dist;
			sphere.position.y = y + sun_dir[1]*sun_dist;
			sphere.position.z = z + sun_dir[2]*sun_dist;
		}
	}

	// Update local view view
	if (systemData.localView.ready)
	{
		let { light, scene, objects: {sphere} } = systemData.localView;
		let [ax, ay, az] = [ [1,0,0], [0,1,0], [0,0,1] ];
		let light_pos = GEOM.convertAziZen(ax, ay, az, azimuth, zenith);
		let light_dist = systemData.local_sun_distance;

		let light_dir = GEOM.unit([0-light_pos[0], 0-light_pos[1], 0-light_pos[2]]);

		light.position.x = light_pos[0] * light_dist;
		light.position.y = light_pos[1] * light_dist;
		light.position.z = light_pos[2] * light_dist;

		light.direction.x = light_dir[0];
		light.direction.y = light_dir[1];
		light.direction.z = light_dir[2];

		sphere.position.x = light.position.x;
		sphere.position.y = light.position.y;
		sphere.position.z = light.position.z;

		// Update ambient light and sky colors
		{
			let spa = systemData.spa;
			let t = spa.hour + (spa.minute*60 + spa.second)/(60*60);
			let {K0, K1, ambient0, ambient1, skyblue0, skyblue1} = systemData.dynamic_colors;
			let [u, K] = [0, 0];
			let [r,g,b] = [0,0,0];

			if (spa.sunrise <= t && t <= spa.sunset) {

				if (t < spa.suntransit) {
					u = (t - spa.sunrise) / (spa.suntransit - spa.sunrise);
					K = K0 + u*(K1-K0)
				} else {
					u = (t - spa.suntransit) / (spa.sunset - spa.suntransit);
					u = 1-u;
					K = K0 + u*(K1-K0)
				}

				[r,g,b] = kelvin_to_rgb(K);
			}

			let ambient = systemData.ambient_light;
			if (ambient) {
				ambient.diffuse = new BABYLON.Color3(r/255,g/255,b/255);
				ambient.intensity = ambient0 + u*(ambient1-ambient0);
			}

			scene.clearColor = BABYLON.Color3.Lerp(skyblue0, skyblue1, u);
		}
	}

	// Trigger single-frame update
	systemData.globalView.shouldRender |= RenderFlags.Once;
	systemData.localView.shouldRender |= RenderFlags.Once;
};

//
// Move data from the UI <=> SPA structure
//

systemData.refreshUI = function() {
	for (let ui of systemData.ui_values) {
		ui.load();
	}
};

systemData.refreshSPA = function() {
	for (let ui of systemData.ui_values) {
		ui.store();
	}
};


/*
	**********************************************
	Main code starts here.
	**********************************************
*/


// Set up initial SPA data
{
	let d = new Date();
	let spa = systemData.spa;

	spa.latitude      = lat0;
	spa.longitude     = lon0;

	spa.elevation     = 1850;
	spa.pressure      = 820;
	spa.temperature   = 20;

	spa.year          = d.getFullYear();
	spa.month         = d.getMonth()+1;
	spa.day           = d.getDate();

	spa.hour          = d.getHours();
	spa.minute        = d.getMinutes();
	spa.second        = d.getSeconds();

	spa.timezone      = -6.0;

	spa.delta_ut1     = 0;
	spa.delta_t       = 67;

	spa.slope         = 0;
	spa.azm_rotation  = 0;
	spa.atmos_refract = 0.5667;
	spa.function      = SPA.CalculateWhat.All;

	let result = SPA.calculate(systemData.spa);
	if (result == 0) {
	} else
	{
		console.log('Problem in initial SPA calculation.');
	}
}

// Set up globe view
{
	let view = systemData.globalView;
	let canvas = document.getElementById('renderCanvas');

	if (canvas !== null) {
		populateGlobalView(canvas as HTMLCanvasElement);

		canvas.addEventListener('pointerenter',function(){
			view.shouldRender |= RenderFlags.Loop;
		});

		canvas.addEventListener('pointerout',function(){
			view.shouldRender &= ~RenderFlags.Loop;
		});
	}
}

// Set up local view
{
	let view = systemData.localView;
	let canvas = document.getElementById('renderCanvas2');

	if (canvas !== null) {
		populateLocalView(canvas as HTMLCanvasElement);

		canvas.addEventListener('pointerenter',function(){
			view.shouldRender |= RenderFlags.Loop;
		});

		canvas.addEventListener('pointerout',function(){
			view.shouldRender &= ~RenderFlags.Loop;
		});
	}
}

// Nudge refresh after 100 ms.
window.setTimeout( function() { systemData.refreshViews(); }, 100);

// Ensure views updated if window resized
window.addEventListener('resize', function () {
	systemData.globalView.engine.resize();
	systemData.localView.engine.resize();
	systemData.refreshViews();
});

window.addEventListener('DOMContentLoaded', function() {
	//
	// Launch global view render loop
	//
	{
		const twoPi = 2.0*Math.PI;
		const pulse_period = 2.0*1000, pulse_scale = 0.2; // period in ms
		let theta: number = 0.0, last_time: number|null = null;
		let fps_start: number|null = null, fps_count = 0, fps_every = 2000;
		let view = systemData.globalView;

		view.engine.runRenderLoop( function() {
			if (fps_start === null) { fps_start = Date.now(); }
			if (last_time === null) { last_time = Date.now(); }
			
			let current_time = Date.now();

			fps_count += 1;
			if (current_time-fps_start > fps_every) {
				const fps = 1000.0*fps_count/(current_time-fps_start);
				//console.log(`${fps.toFixed(2)} fps`);
				fps_count = 0;
				fps_start = current_time;
			}

			theta += (current_time-last_time)/pulse_period * twoPi;
			if (theta > twoPi) theta -= twoPi;

			let marker = view.objects.location;
			if (marker !== null) {
				const u = 0.5*(1.0-Math.cos(theta));
				marker.scaling.x = 1.0 + pulse_scale*u;
				marker.scaling.y = 1.0 + pulse_scale*u;
				marker.scaling.z = 1.0 + pulse_scale*u;
			}

			last_time = current_time;

			if (view.shouldRender !== RenderFlags.Ignore) {
				view.scene.render();
				if ((view.shouldRender & RenderFlags.Once) != 0) {
					view.shouldRender = view.shouldRender &= ~RenderFlags.Once;
				}
			}
		});
	}

	//
	// Launch local view render loop
	//
	{
		let view = systemData.localView;

		view.engine.runRenderLoop( function() {
			if (view.shouldRender !== RenderFlags.Ignore) {
				view.scene.render();
				if ((view.shouldRender & RenderFlags.Once) != 0) {
					view.shouldRender = view.shouldRender &= ~RenderFlags.Once;
				}
			}
		});
	}
});


{
	let uiContainer = document.getElementById('uiContainer');

	let div = document.createElement("div");

	let location = document.createElement("select");

	for (let w of systemData.local_waypoints) {
		let {name,lat,lon} = w;

		let [lat_dec,lon_dec] = [hms_to_dec(lat[0],lat[1],lat[2]),hms_to_dec(lon[0],lon[1],lon[2])];
		let [lat_hms,lon_hms] = [dec_to_hms(lat_dec),dec_to_hms(lon_dec)];
		let [lon_m,lat_m] = lonlat_degs_to_m(lon_dec, lat_dec);

		console.log(`${name} ${lat} ${lon}`);
		console.log(`  ${lat} => ${lat_dec} => ${lat_hms} => ${lat_m}`);
		console.log(`  ${lon} => ${lon_dec} => ${lon_hms} => ${lon_m}`);

		let option = document.createElement("option");
		option.text = `${name} ${lat[0]}\"${lat[1]}'${lat[2]} ${lon[0]}\"${lon[1]}'${lon[2]}`;
		location.add(option);
	}

	location.onchange = function() {
		let idx = location.selectedIndex;
		let waypoint = systemData.local_waypoints[idx];
		let {lat,lon} = waypoint;
		let lat_dec = hms_to_dec(lat[0],lat[1],lat[2]);
		let lon_dec = hms_to_dec(lon[0],lon[1],lon[2]);
		
		systemData.spa.latitude  = lat_dec;
		systemData.spa.longitude = lon_dec;

		let x = (lon_dec-lon0) * lon_m_per_deg;
		let z = (lat_dec-lat0) * lat_m_per_deg;
		let y = 0;

		// Ray cast down from elevated position to find collision
		// with mesh below.
		{
			let origin = BV3([x,+1000,z]);
			let direction = BV3([0,-1,0]);
			let ray = new BABYLON.Ray(origin,direction,2000);
			let scene = systemData.localView.scene;
			
			let hit = scene.pickWithRay(ray, (m: BABYLON.Mesh) => {
				let val = systemData.local_marker ? systemData.local_marker.parent : null;
				return (!val || m === val); 
			});

			if (hit.hit) {
				x = hit.pickedPoint.x;
				y = hit.pickedPoint.y + 1.5; // slightly above; average observer height?
				z = hit.pickedPoint.z;
			}
		}

		// Set camera target and local marker position to hit coords
		let vec = BV3([x,y,z])
		systemData.localView.camera.lockedTarget = vec;

		if (systemData.local_marker) {
			systemData.local_marker.position = vec;
		}

		systemData.refreshUI();
		systemData.refreshViews();
	}

	div.appendChild(location);

	{
		let subdiv = document.createElement('div');
		subdiv.appendChild(document.createElement('br'));
		subdiv.appendChild(document.createElement('br'));
		div.appendChild(subdiv);
	}

	// time of year stuff
	{
		let spa = systemData.spa;
		let [y, m, d] = [spa.year, spa.month, spa.day];

		let subdiv = document.createElement('div');

		let label = document.createElement('div');
		label.innerHTML = `Year, month, day (local); timezone (UTC): `;

		let year = document.createElement('input');
		year.type = 'number';
		Object.assign(year, {min: -5000, max: 2500, step: 1, value: y});

		let month = document.createElement('input');
		month.type = 'number';
		Object.assign(month, {min: 1, max: 12, step: 1, value: m});

		let day = document.createElement('input');
		day.type = 'number';
		Object.assign(day, {min: 1, max: 31, step: 1, value: d});

		let tz = document.createElement('input');
		tz.type = 'number';
		Object.assign(tz, {min: -12, max: 13, step: 1, value: -7}); // +13 seems to exist only for Tonga!

		let year_ui = new UIValue(
			() => {year.value = `${spa.year}`},
			() => {spa.year = year.valueAsNumber} );

		let month_ui = new UIValue(
			() => {month.value = `${spa.month}`},
			() => {spa.month = month.valueAsNumber} );

		let day_ui = new UIValue(
			() => {day.value = `${spa.day}`},
			() => {spa.day = day.valueAsNumber} );

		let tz_ui = new UIValue(
			() => {tz.value = `${spa.timezone}`},
			() => {spa.timezone = tz.valueAsNumber} );

		year.oninput = function() {
			systemData.refreshSPA();
			systemData.refreshUI();
			systemData.refreshViews();
		}

		month.oninput = function() {
			systemData.refreshSPA();
			systemData.refreshUI();
			systemData.refreshViews();
		}

		day.oninput = function() {
			systemData.refreshSPA();
			systemData.refreshUI();
			systemData.refreshViews();
		}

		tz.oninput = function() {
			systemData.refreshSPA();
			systemData.refreshUI();
			systemData.refreshViews();
		}

		systemData.ui_values.push(year_ui);
		systemData.ui_values.push(month_ui);
		systemData.ui_values.push(day_ui);
		systemData.ui_values.push(tz_ui);

		subdiv.appendChild(label);
		subdiv.appendChild(year);
		subdiv.appendChild(month);
		subdiv.appendChild(day);
		subdiv.appendChild(tz);

		div.appendChild(subdiv);
	}

	// year-based checkpoints
	{
		let subdiv = document.createElement('div');

		// Be careful; Java/Typescript months are zero-based!
		for (let what of [Season.MarchEquinox, Season.JuneSolstice, Season.SeptemberEquinox, Season.DecemberSolstice]) {

			let btn = document.createElement("button");
			btn.innerHTML = `${Season[what]}`;
			btn.onclick = function () {
				let spa = systemData.spa;
				let [year,month,day, hour,minute,second] = GetSeasonUTC(what, spa.year);
				
				// adjust date for timezone; try to do everything in UTC
				let date = new Date( Date.UTC(year,month-1,day, hour,minute,second) );
				console.log(Season[what], date.toUTCString(), "(UTC)");
				date.setTime( date.getTime() + spa.timezone * 60*60 * 1000 );
				console.log(Season[what], date.toUTCString(), `(LOCAL: UTC + ${spa.timezone})`);

				// set SPA values; note that we use values from adjusted UTC
				year = date.getUTCFullYear();
				month = date.getUTCMonth()+1;
				day = date.getUTCDate();

				hour = date.getUTCHours();
				minute = date.getUTCMinutes();
				second = date.getUTCSeconds();

				([spa.year,spa.month,spa.day, spa.hour,spa.minute,spa.second] = [year,month,day, hour,minute,second]);

				systemData.refreshUI();
				systemData.refreshViews();
			}

			subdiv.appendChild(btn);
		}

		div.appendChild(subdiv);
	}

	{
		let subdiv = document.createElement('div');
		subdiv.appendChild(document.createElement('br'));
		subdiv.appendChild(document.createElement('br'));
		div.appendChild(subdiv);
	}

	// time of day stuff
	{
		let spa = systemData.spa;
		let [h, m, s] = [spa.hour, spa.minute, spa.second];

		let subdiv = document.createElement('div');

		let label = document.createElement('div');
		label.innerHTML = `Hour minute second: `;

		let hour = document.createElement('input');
		hour.type = 'number';
		Object.assign(hour, {min: 0, max: 23, step: 1, value: h});

		let min = document.createElement('input');
		min.type = 'number';
		Object.assign(min, {min: 0, max: 59, step: 1, value: m});

		let sec = document.createElement('input');
		sec.type = 'number';
		Object.assign(sec, {min: 0, max: 59, step: 1, value: s});

		let slider = document.createElement('input');
		slider.type = `range`;
		Object.assign(slider, {min: 0, max: (24*60*60)-1, step: 1, value: hms_to_sec(h,m,s)});

		let hour_ui = new UIValue(
			() => {hour.value = `${spa.hour}`},
			() => {spa.hour = hour.valueAsNumber} );

		let min_ui = new UIValue(
			() => {min.value = `${spa.minute}`},
			() => {spa.minute = min.valueAsNumber} );

		let sec_ui = new UIValue(
			() => {sec.value = `${spa.second}`},
			() => {spa.second = sec.valueAsNumber} );

		let slider_ui = new UIValue(
			() => { slider.value = `${hms_to_sec(spa.hour, spa.minute, spa.second)}`; },
			() => {} );

		hour.oninput = function() {
			systemData.refreshSPA();
			systemData.refreshUI();
			systemData.refreshViews();
		}

		min.oninput = function() {
			systemData.refreshSPA();
			systemData.refreshUI();
			systemData.refreshViews();
		}

		sec.oninput = function() {
			systemData.refreshSPA();
			systemData.refreshUI();
			systemData.refreshViews();
		}

		slider.oninput = function() {
			([spa.hour, spa.minute, spa.second] = sec_to_hms(parseInt(slider.value)));
			systemData.refreshUI();
			systemData.refreshViews();
		};

		systemData.ui_values.push(hour_ui);
		systemData.ui_values.push(min_ui);
		systemData.ui_values.push(sec_ui);
		systemData.ui_values.push(slider_ui);

		subdiv.appendChild(label);
		subdiv.appendChild(hour);
		subdiv.appendChild(min);
		subdiv.appendChild(sec);
		subdiv.appendChild(slider);

		div.appendChild(subdiv);
	}

	// day-based checkpoints
	{
		let subdiv = document.createElement('div');

		let sunrise = document.createElement("button");
		sunrise.innerHTML = "Sunrise";
		sunrise.onclick = function () {
			let spa = systemData.spa;
			[spa.hour, spa.minute, spa.second] = SPA.time_to_hms(spa.sunrise);
			systemData.refreshUI();
			systemData.refreshViews();
		}

		let transit = document.createElement("button");
		transit.innerHTML = "Transit";
		transit.onclick = function () {
			let spa = systemData.spa;
			[spa.hour, spa.minute, spa.second] = SPA.time_to_hms(spa.suntransit);
			systemData.refreshUI();
			systemData.refreshViews();
		}

		let sunset = document.createElement("button");
		sunset.innerHTML = "Sunset";
		sunset.onclick = function () {
			let spa = systemData.spa;
			[spa.hour, spa.minute, spa.second] = SPA.time_to_hms(spa.sunset);
			systemData.refreshUI();
			systemData.refreshViews();
		}

		subdiv.appendChild(sunrise);
		subdiv.appendChild(transit);
		subdiv.appendChild(sunset);

		div.appendChild(subdiv);
	}

	uiContainer?.appendChild(div);

	{
		for (let when of [2021, 1412, 1954, 1582, 1312]) {
			console.log("");
			for (let what of [Season.MarchEquinox, Season.JuneSolstice, Season.SeptemberEquinox, Season.DecemberSolstice]) {
				let [year,month,day, hour,minute,second] = GetSeasonUTC(what, when);
				console.log(Season[what], `${year}/${month}/${day} ${hour}:${minute}:${second}`);
			}
		}
	}

}
