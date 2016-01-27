/// <reference path="cell.js"/>
/**
 * Very similar to the board prototype. But now in 3D !! It is no more possible to pick mesh, just a random distribution.
 * This is because it is not possible to get transparent particels with correct faces to each other :(
 * That is also the reason why dead cells are just not visible. Now the SPS disposes all mesh every round and creates a new one (just the living cells)
 */

//@game : main game object
function Box(game){
    if ( !(this instanceof Box) )
        throw new Error("Constructor in 'Box' called as a function");

    //Variables
    this.sizeX;             //Maximum Size in X-Direction
    this.sizeY;             //Maximum Size in Y-Direction
    this.sizeZ;             //Maximum Size in Y-Direction
    this.game = game;
    this.cells = [];        //Stores all cell objects
    this.sps = null;        //Babylon JS Solid Partical System
    this.forzen;            //If the game is running, but all cells are static or dead, the board is frozen
}

//Change Size of the Board
//@sizeX : new board size in x-direction
//@sizeY : new board size in y-direction (z-direction in webGL)
Board.prototype.setSize = function(sizeX, sizeY, sizeZ){
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;
}

//Create Inital Box (just the states NO MESH). The Mesh is disposed and create on every time "next Round is called"
//@shape : the shape the Mesh Builder should create (Box or Sphere) 
Board.prototype.initBox = function(shape){    
    
    this.shape = shape;
    var spsCounter = 0;
    var state = 0;
    
    for(var x = 0; x < this.sizeX; x++){  
        this.cells[x] = []; 
        for(var y = 0; y < this.sizeY; y++){
            this.cells[x][y] = [];
            for(var z = 0; z < this.sizeZ; z++){
                state = Math.random() > 0.9 ? 1 : 0;
                this.cells[x][y][z] = new Cell(this.game, (x-this.sizeX/2 + 0.5)*5 , (y-this.sizeY/2 + 0.5)*5, (z-this.sizeZ/2 + 0.5)*5, state, null);  
                //Count all living cells to know how many objects the sps has to create
                if(state == 1)
                    spsCounter++; 
            }
        } 
    }
    
    this.frozen = false;
}  

//Reset board, delete mesh, sps and the cell objects
Board.prototype.reset = function(){
    for(var x = 0; x < this.cells.length; x++){  
        for(var y = 0; y < this.cells[x].length; y++){
            for(var z = 0; z < this.cells[x][y].length; z++){
                this.cells[x][y] = null;    //Set to null so the GB can collect it
            }
        } 
    }
    this.sps.dispose();
    this.sps = null;    //Set to null so the GB can collect it
}


/*******************************/
/***** Conway Algorithm *******/
/*****************************/
//As a ruleset the 4555 rule is used. It is by Carter Bay and described in more detail in : A New Candidate Rule for the Game of Three-Dimensional Life (1992)
//This is called for every time a new round has be calculated
Board.prototype.nextRound = function(){ 
    var tmpCells = [];        
    var spsCounter = 0;                                                     //Needed to update the board in disrect time steps
    for(var x = 0; x < this.sizeX; x++){  
        tmpCells[x] = [];
        for(var y = 0; y < this.sizeY; y++){                                //Loop through all the cells
            tmpCells[x][y] = [];
            for(var z = 0; z < this.sizeZ; z++){
                var living = this.cells[x][y][z].isAlive();                 //Ceck if the current cell is alive or dead
                var counter = this.countLivingNeighbours(x , y , z);        //Check how many living cells the current one has
                var result = living;                                        //Store original state in result => dead or alive (0 or 1)
                
                //All rules are applayed right here
                if(living && counter < 4 || counter > 5)                    //Rule: cell dies if there are more then 5 or less then 4 living neighbours
                    result = 0;
                else if(!living && counter == 5)                            //Rule: is the cell dead already and there are exactly 5 living neighbours => the cell is born
                    result = 1; 
                
                //If current cell has the state of being alive, increase the spsCounter to create Mesh later on
                if(result == 1)
                    spsCounter++;
                    
                tmpCells[x][y][z] = result;                                    //Write result into temporary Array
            }
        } 
    }
    
    //Creating Mesh
    //==================================================
    if(this.sps != null)
        this.sps.dispose();     //Remove all mesh
        
    var cellObj;
    if(this.shape == "spheres")
        cellObj = BABYLON.MeshBuilder.CreateSphere("SPS", { segments: 4 ,diameterX: 4,diameterY: 4, diameterZ: 4}, this.game.scene);
    else
        cellObj =  BABYLON.MeshBuilder.CreateBox("SPS", {size: 3.3}, this.game.scene);   
     
    this.sps = new BABYLON.SolidParticleSystem("SPS", this.game.scene);    
    this.sps.addShape(cellObj, spsCounter);
    this.sps.buildMesh();
    cellObj.dispose();
      
    //Update the actuall Cells
    var cellsChanging = false;      //Check if at least one cell has changed its state on the board
    for(var x = 0; x < this.sizeX; x++){  
        for(var y = 0; y < this.sizeY; y++){ 
            for(var z = 0; z < this.sizeZ; z++){
                if(this.cells[x][y][z].isAlive() != tmpCells[x][y][z]){
                    this.cells[x][y][z].setState(tmpCells[x][y][z]);
                    cellsChanging = true;
                }
                if(this.cells[x][y][z].isAlive()){
                    this.cells[x][y][z].mesh = this.sps.particles[spsCounter];  
                    this.cells[x][y][z].init();  
                    spsCounter++;    
                }
            }
        } 
    }
    
    this.frozen = !cellsChanging;
    
    this.sps.setParticles();
}

//Check how many living neighbours are cell has
//@x : x-Index of the cell that is checked for living neighbours
//@y : y-Index of the cell that is checked for living neighbours
Board.prototype.countLivingNeighbours = function(x , y, z){
    var countAlive = 0;
    
    //6 Center
    if(this.cells[this.lookUpXHigh(x+1)][y][z].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][y][z].isAlive()) countAlive++;
    if(this.cells[x][this.lookUpYHigh(y+1)][z].isAlive()) countAlive++;
    if(this.cells[x][this.lookUpYLow(y-1)][z].isAlive()) countAlive++;
    if(this.cells[x][y][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[x][y][this.lookUpZLow(z-1)].isAlive()) countAlive++;
    
    //12 Edges
        //Right Side
    if(this.cells[this.lookUpXHigh(x+1)][y][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][y][this.lookUpZLow(z-1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYHigh(y+1)][z].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYLow(y-1)][z].isAlive()) countAlive++;
        //Left Side
    if(this.cells[this.lookUpXLow(x-1)][y][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][y][this.lookUpZLow(z-1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYHigh(y+1)][z].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYLow(y-1)][z].isAlive()) countAlive++;
        //"Middle" Layer
    if(this.cells[x][this.lookUpYHigh(y+1)][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[x][this.lookUpYHigh(y+1)][this.lookUpZLow(z-1)].isAlive()) countAlive++;
    if(this.cells[x][this.lookUpYLow(y-1)][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[x][this.lookUpYLow(y-1)][this.lookUpZLow(z-1)].isAlive()) countAlive++;
     
    //8 Corners
        //Right Side
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYHigh(y+1)][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYHigh(y+1)][this.lookUpZLow(z-1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYLow(y-1)][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXHigh(x+1)][this.lookUpYLow(y-1)][this.lookUpZLow(z-1)].isAlive()) countAlive++;
        //Left Side
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYHigh(y+1)][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYHigh(y+1)][this.lookUpZLow(z-1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYLow(y-1)][this.lookUpZHigh(z+1)].isAlive()) countAlive++;
    if(this.cells[this.lookUpXLow(x-1)][this.lookUpYLow(y-1)][this.lookUpZLow(z-1)].isAlive()) countAlive++;

    return countAlive;
}

//Check if X-Value is too big and has to start at 0
//@x : x-Index of Cells array that should be looked up if its valid
Board.prototype.lookUpXHigh = function(x){
    if(x >= (this.sizeX))
        return 0;
    return x; 
}

//Check if X-Value is too small and has to start at 0
//@x : x-Index of Cells array that should be looked up if its valid
Board.prototype.lookUpXLow = function(x){
    if(x < 0)
        return (this.sizeX - 1);
    return x; 
}

//Check if Y-Value is too big and has to start at 0
//@y : y-Index of Cells array that should be looked up if its valid
Board.prototype.lookUpYHigh = function(y){
    if(y >= (this.sizeY)) 
        return 0;
    return y;
}

//Check if Y-Value is too small and has to start at 0
//@y : y-Index of Cells array that should be looked up if its valid
Board.prototype.lookUpYLow = function(y){
    if(y < 0)
        return (this.sizeY - 1);
    return y;
}

//Check if Z-Value is too big and has to start at 0
//@y : z-Index of Cells array that should be looked up if its valid
Board.prototype.lookUpZHigh = function(z){
    if(z >= (this.sizeZ)) 
        return 0;
    return z;
}

//Check if Z-Value is too small and has to start at 0
//@y : z-Index of Cells array that should be looked up if its valid
Board.prototype.lookUpZLow = function(z){
    if(z < 0)
        return (this.sizeZ - 1);
    return z;
}