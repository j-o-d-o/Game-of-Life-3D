/// <reference path="cell.js"/>
/**
 * This is where all the fun happens concerning the Conway algorithm. The Board class has all information needed determine cell states.
 * Maximum
 * 
 */
function Board(a_game){
    if ( !(this instanceof Board) )
        throw new Error("Constructor in 'Board' called as a function");

    //Variables
    this.sizeX;             //Maximum Size in X-Direction
    this.sizeY;             //Maximum Size in Y-Direction (Note that in webGL this is actually the z-direction)
    this.game = a_game;
    this.cells = [];        //Stores all cell objects
    this.sps;               //Babylon JS Solid Partical System
}

//Change Size of the Board
Board.prototype.setSize = function(a_sizeX, a_sizeY){
    this.sizeX = a_sizeX;
    this.sizeY = a_sizeY;
}

//Create Board using the SPS to create Mesh for every Cell and than create the Cell Objects
Board.prototype.createBoard = function(shape, dist, callback){
    var cellObj;
    if(shape == "spheres")
        cellObj = BABYLON.MeshBuilder.CreateSphere("SPS", { segments: 4 ,diameterX: 4,diameterY: 4, diameterZ: 4}, this.game.scene, {isPickable: true});
    else
        cellObj =  BABYLON.MeshBuilder.CreateBox("SPS", {size: 3.3}, this.game.scene, {isPickable: true});   
    
    this.sps = new BABYLON.SolidParticleSystem("SPS", this.game.scene, {isPickable: true});    
    this.sps.addShape(cellObj, this.sizeX * this.sizeY);
    this.sps.buildMesh();
    cellObj.dispose(); 
    
    var spsCounter = 0;
    for(var x = 0; x < this.sizeX; x++){  
        this.cells[x] = []; 
        for(var y = 0; y < this.sizeY; y++){
            var state;
            if(dist == "random")
                state = Math.random() > 0.9 ? 1 : 0;
            else    
                state = 0;
            this.cells[x][y] = new Cell(this.game, (x-this.sizeX/2 + 0.5)*5 , (y-this.sizeY/2 + 0.5)*5, state, this.sps.particles[spsCounter]);
            this.cells[x][y].init(); 
            spsCounter++; 
        } 
    }
    this.sps.setParticles();
    callback();
}  

//Reset board, delete mesh, sps and the cell objects
Board.prototype.reset = function(){
    for(var x = 0; x < this.cells.length; x++){  
        var cellsY = this.cells[x];
        for(var y = 0; y < cellsY.length; y++){
            this.cells[x][y] = null;    //Set to null so the GB can collect it
        } 
    }
    this.sps.dispose();
    this.sps = null;    //Set to null so the GB can collect it
}

//Called when user wants to select inital sate by himself, Creates event handelers for the the picking
Board.prototype.startSelection = function(){
    this.sps.refreshVisibleSize();
    var _this = this;
    var activeIdx = -1;    
   
    /*  This is kind of a hack, because babylon js doesnt feature a ... onPointerClickDownAndUp
        I store the activeIdx when clicking Down and the when clicking Up the state only gets changed
        if the idx is the same as when clicked down. This ensures that the user can move around the
        camera without changing the cells all the time  */
   
    this.game.scene.onPointerDown = function(evt, pickResult) {      
        var meshFaceId = pickResult.faceId; 
        if (meshFaceId == -1) {
            activeIdx = -1;
            return;
        }        
        activeIdx = _this.sps.pickedParticles[meshFaceId].idx;
        return;
    }
    this.game.scene.onPointerUp = function(evt, pickResult) {
        var meshFaceId = pickResult.faceId;            
        if (meshFaceId == -1) {return;}                    
        var idx = _this.sps.pickedParticles[meshFaceId].idx; 
        if(activeIdx == idx){
            //The sps stores the mesh in one dimensional array, this is to find the corresponding cell x-id and y-id
            var x = Math.floor(idx / _this.sizeX);
            var y = idx - (x * _this.sizeX); 
    
            if(_this.cells[x][y].isAlive())
                _this.cells[x][y].setState(0);
            else
                _this.cells[x][y].setState(1);
            _this.sps.setParticles();
        }
        else{
            activeIdx = -1;
            return;
        }
    };
}

//Remove the event listeners to pick mesh and change its state
Board.prototype.endSelection = function(){
    this.game.scene.onPointerDown = function(evt, pickResult) {      
        return;
    }
    this.game.scene.onPointerUp = function(evt, pickResult) {
        return;
    };
}



/*******************************/
/***** Conway Algorithm *******/
/*****************************/

//This is called for every time a new round has be calculated
Board.prototype.nextRound = function(){ 
    var tmpCells = [];                                                  //Needed to update the board in disrect time steps
    for(var x = 0; x < this.sizeX; x++){  
        tmpCells[x] = [];
        for(var y = 0; y < this.sizeY; y++){                            //Loop through all the cells
            var living = this.cells[x][y].isAlive();                    //Ceck if the current cell is alive or dead
            var counter = this.countLivingNeighbours(x , y);            //Check how many living cells the current one has
            var result = living;                                        //Store the result => dead or alive (0 or 1)
            
            //All rules are applayed right here
            if(living && counter < 2 || counter > 3)                    //Rule: cell dies if there are more then 3 or less then 2 living neighbours
                result = 0;
            else if(!living && counter == 3)                            //Rule: is the cell dead already and there are exactly 2 living neighbours => the cell is born
                result = 1; 
            
            tmpCells[x][y] = result;                                    //Write result into temporary Array
        } 
    }
    
    //Update the actuall Cells
    for(var x = 0; x < this.sizeX; x++){  
        for(var y = 0; y < this.sizeY; y++){
            this.cells[x][y].setState(tmpCells[x][y]);
        } 
    }
    
    this.sps.setParticles();
}

//Check how many living neighbours are cell has
Board.prototype.countLivingNeighbours = function(x , y){
    var countAlive = 0;
    
    if(this.cells[this.lookUpXHigh(x+1)][y].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][y].isAlive()) countAlive++;
    if(this.cells[x][this.lookUpYHigh(y+1)].isAlive()) countAlive++;
    if(this.cells[x][this.lookUpYLow(y-1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYHigh(y+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYLow(y-1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYHigh(y+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYLow(y-1)].isAlive()) countAlive++;

    return countAlive;
}

//Check if X-Value is too big and has to start at 0
Board.prototype.lookUpXHigh = function(x){
    if(x >= (this.sizeX))
        return 0;
    return x; 
}

//Check if X-Value is too small and has to start at 0
Board.prototype.lookUpXLow = function(x){
    if(x < 0)
        return (this.sizeX - 1);
    return x; 
}

//Check if Y-Value is too big and has to start at 0
Board.prototype.lookUpYHigh = function(y){
    if(y >= (this.sizeY)) 
        return 0;
    return y;
}

//Check if Y-Value is too small and has to start at 0
Board.prototype.lookUpYLow = function(y){
    if(y < 0)
        return (this.sizeY - 1);
    return y;
}
