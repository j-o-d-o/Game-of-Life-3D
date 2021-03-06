/// <reference path="board.js"/>
/// <reference path="box.js"/>
/// <reference path="sounds.js"/>
/**
 * Main Game Prototype, all the logic like pausing, restarting ... is located here
 * Also Babylon will be initilized here and the world will be created, including things like camera or lights
 * This Game Prototype is relativly "dumb", if something can be executed or not is determined by the state machine in main.js
 */
 
function Game(){
    if ( !(this instanceof Game) )
        throw new Error("Constructor in 'Game' called as a function");

    //Variables
    this.canvas;
    this.engine;
    this.scene;
    this.light;
    this.camera;
    this.timeInterval = timeInterval.getTimeInterval();      //Current setting of the time interval (how fast the game is playing the next round)
    this.roundCounter = 1;                                   //Keeps track of how many rounds have been simulated
    this.board = new Board(this);
    this.box = new Box(this);
    this.sounds = new Sounds(this);
    this.paused = true;
    this.gameMode = 1;                                      //Default game mode 1 : 2D-Game, 2 : 3D-Game
   
    
	var _this = this;
	window.addEventListener('DOMContentLoaded', function(){
        _this.init();   //Init Babylon JS
	});
}

//Initilize Babylon and everything that comes with it (camera, lights, sounds ...)
Game.prototype.init = function(){
    this.canvas = document.getElementById('renderCanvas');
    this.engine = new BABYLON.Engine(this.canvas, true);
	this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color3(0.09, 0.09, 0.09);
     
    this.createCamera();
    this.createLight();
    this.registerEventListener();
    this.sounds.loadSounds();

    var _this = this;
    this.scene.executeWhenReady(function () {
        _this.startRenderLoop();
    });
} 

//All event listeners that babylon js need go here
Game.prototype.registerEventListener = function(){
	var _this = this; 
	window.addEventListener('resize', function(){
		_this.engine.resize();
	}); 
}

//Create a Arc Rotate Camera
Game.prototype.createCamera = function(){
    //Create Free camera
    this.cameraFree = new BABYLON.FreeCamera("FreeCamera", new BABYLON.Vector3(100, 0, 100), this.scene);
    this.cameraFree.keysUp = [87]; // W
	this.cameraFree.keysDown = [83]; // S 
	this.cameraFree.keysLeft = [65]; // A
	this.cameraFree.keysRight = [68]; // D  
    this.cameraFree.speed = 4;
    this.cameraFree.minZ = 0.1;
    //Creat Arc Camera
    this.cameraArc = new BABYLON.ArcRotateCamera("ArcRotateCamera", 0, 0, 0, BABYLON.Vector3.Zero(), this.scene);
    this.cameraArc.setPosition(new BABYLON.Vector3(0, 235, -150));
    this.cameraArc.minZ = 0.1; 
    //Set Arc as Defualt camera
    this.scene.activeCamera = this.cameraArc;
    this.cameraArc.attachControl(this.canvas, false);  
} 

//Create Lights, maybe add another lightsource (like a directional light from below)
Game.prototype.createLight = function(){
    this.light = new BABYLON.HemisphericLight('lightHs',new BABYLON.Vector3(0.2, 1, 0.2), this.scene); 
	this.light.specular = new BABYLON.Color3(0.1, 0.1, 0.1);
    this.light.intensity = 1.3;
    this.light2 = new BABYLON.HemisphericLight('lightHs2',new BABYLON.Vector3(0.2, -1, 0.2), this.scene); 
	this.light2.specular = new BABYLON.Color3(0.2, 0.2, 0.2);
    this.light2.intensity = 0.3;
}

//Render Loop, this is called per Frame, 
Game.prototype.startRenderLoop = function(){
	var _this = this;
    var time = 0; 
	this.engine.runRenderLoop(function(){
        time += 1/_this.engine.getFps();        //Calculate passed Time per Frame and add it to the passed Time overall
        if(time > _this.timeInterval){          //Check if interval time has been reached
            time = 0;
            $("#roundCounter span").html(_this.roundCounter);
            if(!_this.paused){
                if(_this.gameMode == 1)
                    _this.board.nextRound();
                else if(_this.gameMode == 2)
                    _this.box.nextRound();
                
                _this.roundCounter++; 
                if(!_this.board.frozen && !_this.box.frozen)
                    _this.sounds.playRandomSound();              
            }
        }
        
        _this.scene.render();
	});
}


/**********************************************/
/**** Methods triggered vai State Machine ****/
/********************************************/

//Begin the game, this is the initial start call, all mesh is loaded here
//@shape : cube / sphere
//@dist : distribution, random or by hand
//@sizeX & sizeY : board size in x an y direction
//@callback : Callback after loading the board (used to hide the loading info at the end)
Game.prototype.begin2D = function(shape, dist, sizeX, sizeY, callback){
    this.board.setSize(sizeX, sizeY);       
    this.board.createBoard(shape, dist, callback);
    this.gameMode = 1;
    
    if(dist == "random"){
        this.checkSound();
        this.paused = false;
        this.sounds.start();
    }
    else{
        this.board.startSelection();
    } 
}
Game.prototype.begin3D = function(shape, sizeX, sizeY, sizeZ){
    this.box.setSize(sizeX, sizeY, sizeZ);       
    this.box.init(shape); 
    this.gameMode = 2;
    this.checkSound();
    this.paused = false;
    this.sounds.start();
}

//When user is done selecting inital cells, start the game
Game.prototype.selectDone = function(){
    this.paused = false;
    this.checkSound();
    this.board.endSelection();
    this.sounds.start();
}

//Resume the game
Game.prototype.resume = function(){
    this.paused = false;
}

//Pause the game
Game.prototype.pause = function(){
    this.paused = true;
}

//Restart the game
Game.prototype.restart = function(){
    this.paused = true;
    this.roundCounter = 1;
    this.board.reset();
    this.box.reset();
    this.sounds.menu();
    this.board.endSelection();
}

//Set new Time interval because user changed it
//@timeInterval = new time interval in seconds
Game.prototype.setTimeInterval = function(timeInterval){
    this.timeInterval = timeInterval;
    //If timeinterval goes below 40ms turn of sound because it gets really messy
    this.checkSound();
}
 
//User wants to have the free Camera
Game.prototype.useFreeCamera = function(){
    this.cameraArc.detachControl(this.canvas);
    this.cameraFree.position = this.cameraArc.position.clone();
    this.cameraFree.setTarget(new BABYLON.Vector3.Zero()); //If target is not a (0,0,0), exchange with target position
    this.scene.activeCamera = this.cameraFree;
    this.cameraFree.attachControl(this.canvas, false);
}

//User wants to move around with the Arc Rotate Camera (default)
Game.prototype.useArcCamera = function(){
    this.cameraFree.detachControl(this.canvas);
    this.cameraArc.setPosition(this.cameraFree.position.clone());
    this.scene.activeCamera = this.cameraArc; 
    this.cameraArc.attachControl(this.canvas, false);
}

//Checks for timeinterval if sounds need to be turend off
Game.prototype.checkSound = function(){
    if(this.timeInterval < 0.05)
        this.sounds.mute(); 
    else
        this.sounds.unMute();
}