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

// From model generation.

const lon0 = -107.95972;
const lat0 = 36.06069;

const lon_m_per_deg = 89889.30427959062;
const lat_m_per_deg = 111194.92664455873;

function lonlat_degs_to_m(lon: number, lat: number): [number,number] {
	return [ (lon-lon0)*lon_m_per_deg, (lat-lat0)*lat_m_per_deg ];
}

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

type Waypoint = {
	name: string;
	lat: number[];
	lon: number[];
};

// Storage type for system data
type systemData = {
	uiControls:   UI.ControlGroup[];

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

	K0: number; // min color temp, Kelvin
	K1: number; // max color temp, Kelvin

	ambient0: number; // min ambient intensity
	ambient1: number; // max ambient intensity
	ambient_light?: BABYLON.HemisphericLight;

	skyblue0: BABYLON.Color3;
	skyblue1: BABYLON.Color3;
};


/*
	**********************************************
	Central repository for all system data.
	**********************************************
*/


let systemData: systemData = {

	// Get/set methods added to each control in creatwUI()
	// Note that the min/max params appear to control the size of the resultant
	// edit controls, so although scientific notation works it's best to use
	// the "full" numbers to ensure the controls are an appropriate size.
	uiControls: [
		{
			caption: 'Latitude',
			controls: [
				{ key: 'latitude',  hasSlider: true, min: -90,  max: 90,  def: 0, step: 0.1000 }, // degrees
			],
		},

		{
			caption: 'Longitude',
			controls: [
				{ key: 'longitude', hasSlider: true, min: -180, max: 180, def: 0, step: 0.1000 }, // degrees
			],
		},

		null,

		{
			caption: 'Elevation (m), pressure (mbar), temperature (C)',
			controls: [
				{ key: 'elevation',   min: -6500000, max: 1000000, def: 0 }, // metres
				{ key: 'pressure',    min: 0,        max: 5000,    def: 0 }, // millibar
				{ key: 'temperature', min: -273,     max: 6000,    def: 0 }, // Celsius
			],
		},

		null,

		/*
		{
			caption: 'Time adjustments: delta UT1 (s), delta T (s)',
			controls: [
				{ key: 'delta_ut1', min: -1,    max: 1,    def: 0, step: 0.1 }, // secs
				{ key: 'delta_t',   min: -8000, max: 8000, def: 0            }, // secs
			],
		},

		{
			caption: 'Local slope (degs), azimuth rotation (degs), atmospheric refraction (degs)',
			controls: [
				{ key: 'slope',         min: -360,  max: 360,  def: 0 }, // degrees
				{ key: 'azm_rotation',  min: -360,  max: 360,  def: 0 }, // degrees
				{ key: 'atmos_refract', min: -5.00, max: 5.00, def: 0 }, // degrees
			],
		},

		null,
		*/

		{
			caption: 'Year, month, day',
			controls: [
				{ key: 'year',  min: -5000, max: 2500, def: 0 },
				{ key: 'month', min: 1,     max: 12,   def: 1 },
				{ key: 'day',   min: 1,     max: 31,   def: 1 },
			],
		},

		{
			caption: 'Hour, minute, second (local); timezone (UTC)',
			controls: [
				{ key: 'hour',      min: 0,   max: 23, def: 0 },
				{ key: 'minute',    min: 0,   max: 59, def: 0 },
				{ key: 'second',    min: 0,   max: 59, def: 0 },
				{ key: 'timezone',  min: -18, max: 18, def: 0, step: 0.5 }, // hours offset from UTC
			],
		},

		null,
	],

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

	K0: 1800,
	K1: 16000,

	ambient0: 0.2,
	ambient1: 1.0,
	ambient_light: undefined,

	skyblue0: new BABYLON.Color3(0.047, 0.078, 0.27),
	skyblue1: new BABYLON.Color3(0, 0.75, 1),
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
//	let [x,y,z] = [[],[],[]]; // no TypeScript equivalent?
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


//function createScene(canvas: any) : any { // FIXME: input/return types
function createView(canvas: any) : [BABYLON.Engine, BABYLON.Scene, BABYLON.ArcRotateCamera] { // FIXME: input/return types
	let engine = new BABYLON.Engine(canvas, true);
	let scene = new BABYLON.Scene(engine);
	let camera = new BABYLON.ArcRotateCamera('camera', 0,0,0, BV3([0,0,0]), scene);
	camera.attachControl(canvas, false);
	return [engine, scene, camera];
}

function populateGlobalView(canvas: any) : void { // FIXME: input type
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

function populateLocalView(canvas: any) : void { // FIXME: input type
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
		camera.minZ = 0.05;
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

					//m.scaling = BV3([0.01, 0.01, 0.01]);

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

	// Update location marker in globe view
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

	// Update sun position in local view
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

		// update light "temperature"
		{
			let spa = systemData.spa;
			let t = spa.hour + (spa.minute*60 + spa.second)/(60*60);
			let {K0, K1} = systemData;
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
				let [a0, a1] = [systemData.ambient0, systemData.ambient1];
				ambient.diffuse = new BABYLON.Color3(r/255,g/255,b/255);
				ambient.intensity = a0 + u*(a1-a0);
			}

			scene.clearColor = BABYLON.Color3.Lerp(systemData.skyblue0, systemData.skyblue1, u);
		}
	}

	// Trigger single-frame update
	systemData.globalView.shouldRender |= RenderFlags.Once;
	systemData.localView.shouldRender |= RenderFlags.Once;
};

systemData.refreshUI = function() {
	let groups = systemData.uiControls;
	let spa =  systemData.spa;

	for (let group of groups) {
		if (group === null) continue;
		let controls = group.controls;
		for (let control of controls) {
			if (control == null || control.set == null) continue;
			control.set( spa[control.key] );
		}
	}
};

systemData.refreshSPA = function() {
	let groups = systemData.uiControls;
	let spa =  systemData.spa;

	for (let group of groups) {
		if (group === null) continue;
		let controls = group.controls;
		for (let control of controls) {
			if (control == null || control.get == null) continue;
			spa[control.key] = control.get();
		}
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
	const [lat, lon] = [ lat0, lon0 ];

	spa.latitude      = lat;
	spa.longitude     = lon;

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

// Set up UI elements
{
	let uiContainer = document.getElementById('uiContainer');
	UI.create(uiContainer, systemData.uiControls, systemData.refreshViews);
	systemData.refreshUI();
}

// Set up globe view
{
	let view = systemData.globalView;
	let canvas = document.getElementById('renderCanvas');

	if (canvas !== null) {
		populateGlobalView(canvas);

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
		populateLocalView(canvas);

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

	let sunrise = document.createElement("button");
	sunrise.innerHTML = "Sunrise";
	sunrise.onclick = function () {
		let spa = systemData.spa;
		let [h,m,s] = SPA.time_to_hms(spa.sunrise);
		spa.hour = h;
		spa.minute = m;
		spa.second = s;
		systemData.refreshUI();
		systemData.refreshViews();
	}

	let transit = document.createElement("button");
	transit.innerHTML = "Transit";
	transit.onclick = function () {
		let spa = systemData.spa;
		let [h,m,s] = SPA.time_to_hms(spa.suntransit);
		spa.hour = h;
		spa.minute = m;
		spa.second = s;
		systemData.refreshUI();
		systemData.refreshViews();
	}

	let sunset = document.createElement("button");
	sunset.innerHTML = "Sunset";
	sunset.onclick = function () {
		let spa = systemData.spa;
		let [h,m,s] = SPA.time_to_hms(spa.sunset);
		spa.hour = h;
		spa.minute = m;
		spa.second = s;
		systemData.refreshUI();
		systemData.refreshViews();
	}

	div.appendChild(location);
	div.appendChild(sunrise);
	div.appendChild(transit);
	div.appendChild(sunset);

	uiContainer?.appendChild(div);

	// Temp - "daytime" slider
	{
		let div = document.createElement("div");
		
		let control = document.createElement("input");

		let spa = systemData.spa;
		let val = (spa.hour*60*60) + (spa.minute*60) + spa.second;

		control.type = `range`;
		Object.assign(control, {min: 0, max: 24*60*60, step: 1, value: val});
		control.oninput = function() {
			let val = parseInt(control.value);
			let hour = Math.floor( (val / (60*60)) );
			let minute = Math.floor( (val % (60*60)) / 60 );
			let second = Math.floor( (val % (60*60)) % 60 );
			spa.hour = hour;
			spa.minute = minute;
			spa.second = second;
			systemData.refreshUI();
			systemData.refreshViews();
		};

		div.appendChild(control);

		document.getElementById('uiContainer')?.appendChild(div);
	}

}
