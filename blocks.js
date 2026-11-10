/* A tiny falling-block engine. Coordinates, collisions and row scoring live here. */
(function(root){
 const WIDTH=6, HEIGHT=10;
 const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
 function newGame(random=Math.random){const g={board:Array.from({length:HEIGHT},()=>Array(WIDTH).fill(0)),piece:null,points:0,over:false,won:false};spawn(g,random);return g;}
 function fits(g,matrix,x,y){return matrix.every((row,r)=>row.every((v,c)=>!v||(x+c>=0 && x+c<WIDTH && y+r>=0 && y+r<HEIGHT && !g.board[y+r][x+c])));}
 function spawn(g,random=Math.random){const id=Math.min(6,Math.floor(random()*7));const matrix=SHAPES[id].map(row=>row.slice());g.piece={matrix,x:Math.floor((WIDTH-matrix[0].length)/2),y:0,color:id+1};if(!fits(g,matrix,g.piece.x,0))g.over=true;}
 function move(g,dx,dy){if(g.over||g.won)return false;const p=g.piece;if(fits(g,p.matrix,p.x+dx,p.y+dy)){p.x+=dx;p.y+=dy;return true;}return false;}
 function rotate(g){if(g.over||g.won)return false;const p=g.piece;const m=p.matrix[0].map((_,c)=>p.matrix.map(row=>row[c]).reverse());for(const offset of [0,-1,1,-2,2])if(fits(g,m,p.x+offset,p.y)){p.matrix=m;p.x+=offset;return true;}return false;}
 function lock(g,random){if(g.over||g.won)return;const p=g.piece;p.matrix.forEach((row,r)=>row.forEach((v,c)=>{if(v)g.board[p.y+r][p.x+c]=p.color;}));const keep=g.board.filter(row=>row.some(v=>!v));const lines=HEIGHT-keep.length;while(keep.length<HEIGHT)keep.unshift(Array(WIDTH).fill(0));g.board=keep;g.points+=lines*10;if(g.points>=10){g.won=true;return;}spawn(g,random);}
 function step(g,random=Math.random){if(g.over||g.won)return;if(!move(g,0,1))lock(g,random);}
 function drop(g,random=Math.random){if(g.over||g.won)return;while(move(g,0,1)){}lock(g,random);}
 const api={WIDTH,HEIGHT,newGame,fits,move,rotate,step,drop};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PebbleBlocks=api;
})(globalThis);
