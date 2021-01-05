// https://en.wikipedia.org/wiki/Horizontal_coordinate_system
// https://en.wikipedia.org/wiki/Geographic_coordinate_system

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
				{ key: 'latitude',  hasSlider: true, min: -90,  max: 90,  def: 0, step: 0.100 }, // degrees
			],
		},

		{
			caption: 'Longitude',
			controls: [
				{ key: 'longitude', hasSlider: true, min: -180, max: 180, def: 0, step: 0.100 }, // degrees
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

	// View of the local shadows
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

	local_sun_distance: 250.0,
	local_sun_radius: 10.0,
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

	// Sun direction
	/*
	const [x_,y_,z_] = pos_;
	const p1 = BV3(pos_);
	const p2 = BV3([x_+sun[0]*0.05, y_+sun[1]*0.05, z_+sun[2]*0.05]);
	let sun_dir = BABYLON.Mesh.CreateLines("sunDir", [p1,p2], scene);
	sun_dir.color = new BABYLON.Color3(0.5,0.5,0.5);

	return [sphere, ax, ay, az, sun_dir];
	*/

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
	
	// Light
	{
		let light_pos = [1,1,1];
		let light_dir = GEOM.unit([0-light_pos[0], 0-light_pos[1], 0-light_pos[2]]);
		light = new BABYLON.DirectionalLight('light1', BV3(light_dir), scene);
		light.position = BV3(light_pos);
	}

	// Camera
	{
		camera.position = BV3([-4,4,0]);
		camera.lowerRadiusLimit = 2.05;
	}	

	// Populate scene
	{
		let matSun: any = new BABYLON.StandardMaterial("matSun", scene); // FIXME
		{
			const c = new BABYLON.Color4(0.921, 0.753, 0.204);
			matSun.emissiveColor = c; // required for glow layer
			matSun.ambientColor = c;
		}

		// Local axes
		drawAxes([0,0,0], [1,0,0], [0,1,0], [0,0,1], 1.5, scene);

		// Basic scene components
		const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 2, height: 2}, scene);
		ground.receiveShadows = true;

		const cyl = BABYLON.MeshBuilder.CreateCylinder("cyl", {height: 1, diameter: 0.1}, scene);
		cyl.position = BV3([0,0.5,0]);

		sphere = BABYLON.MeshBuilder.CreateSphere('sphere', {diameter: systemData.local_sun_radius*2}, scene);
		sphere.position = BV3([1,1,1]);
		sphere.material = matSun;

		let cube = BABYLON.MeshBuilder.CreateBox('cube', {size: 0.5}, scene);
		cube.position = BV3([1,1,1]);

		// Glow layer for sun
		let gl = new BABYLON.GlowLayer("glow", scene);
		gl.intensity = 0.5;

		// Shadows
//		const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
		const shadowGenerator = new BABYLON.ShadowGenerator(4096, light);
//		const shadowGenerator = new BABYLON.CascadedShadowGenerator(1024, light);
		shadowGenerator.addShadowCaster(cyl);
		shadowGenerator.addShadowCaster(cube);
//		shadowGenerator.useBlurExponentialShadowMap = true;
//		shadowGenerator.useBlurCloseExponentialShadowMap = true;

		BABYLON.SceneLoader.ImportMesh(null, "./models/", "out.obj", scene,
			function onSuccess(meshes, particleSystems, skeletons) {
				console.log(`success! ${meshes.length}`);
				let m = meshes[0];

				m.receiveShadows = true;

				m.scaling = BV3([0.01, 0.01, 0.01]);

				// We likely don't have vertex normals in the file to save space. Calculate them here.
				let vtx = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
				if (vtx != null) {
    				let nrm = new Float32Array(vtx.length);
    				BABYLON.VertexData.ComputeNormals(vtx, m.getIndices(), nrm);
    				m.setVerticesData(BABYLON.VertexBuffer.NormalKind, nrm);
    			}

    			systemData.localView.objects.scenery = m;


				let div = document.createElement("div");
    			let control = document.createElement("input");
    			control.type = "checkbox";
    			control.onchange = function() {
    				let c = control.checked;
    				if (c) {
						shadowGenerator.addShadowCaster(m);
    				} else {
						shadowGenerator.removeShadowCaster(m);
    				}
    				systemData.refreshViews();
    				console.log(control.checked);
    			};
    			div.appendChild(control);

				document.getElementById('uiContainer')?.appendChild(div);

   				systemData.refreshViews();
			},
			function onProgress(scene) {
				console.log("progress!");
			},
			function onError(scene) {
				console.log("error!");
			},
		);
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
				//txt += `${line.replace(/ /g,'&nbsp')}<br>`;
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
	const [lat, lon] = [ 35.2226, -97.4395 ]; // Norman, OK

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

// Ensure vies updated if window resized
window.addEventListener('resize', function () {
	systemData.globalView.engine.resize();
	systemData.localView.engine.resize();
	systemData.refreshViews();
});

window.addEventListener('DOMContentLoaded', function() {
	// Update globe view
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

	// Update local view
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
