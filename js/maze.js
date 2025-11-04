document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('mazeCanvas');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('startGame');
  const timerEl = document.getElementById('timer');

  // Maze configuration (will be set from difficulty)
  let ROWS = 21; // odd number for proper maze carving
  let COLS = 21;
  let CELL = Math.floor(canvas.width / COLS); // cell size based on canvas
  const difficultySelect = document.getElementById('difficulty');

  function setDifficultySizes(level){
    // ensure sizes are odd numbers for carving algorithm
    switch(level){
      case 'easy': ROWS = COLS = 11; break;
      case 'hard': ROWS = COLS = 31; break;
      case 'expert': ROWS = COLS = 41; break;
      case 'normal':
      default: ROWS = COLS = 21; break;
    }
    // recompute cell size to fit canvas; use integer cell size
    CELL = Math.floor(Math.min(canvas.width / COLS, canvas.height / ROWS));
  }

  // initialize sizes from UI
  setDifficultySizes(difficultySelect ? difficultySelect.value : 'normal');

  let maze = [];
  let player = { x: 1, y: 1 };
  let startTime = null;
  let timerInterval = null;
  let playing = false;

  function initMaze() {
    maze = Array.from({ length: ROWS }, () => Array(COLS).fill(1));

    function inBounds(x,y){
      return x>0 && y>0 && x<COLS-1 && y<ROWS-1;
    }

    function carve(x,y){
      maze[y][x] = 0;
      const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
      shuffle(dirs);
      for(const [dx,dy] of dirs){
        const nx = x+dx, ny = y+dy;
        if(inBounds(nx,ny) && maze[ny][nx]===1){
          maze[y+dy/2][x+dx/2]=0;
          carve(nx,ny);
        }
      }
    }

    carve(1,1);
    maze[1][1] = 2; // start
    maze[ROWS-2][COLS-2] = 3; // end
    player = { x:1, y:1 };
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const offsetX = (canvas.width - COLS*CELL)/2;
    const offsetY = (canvas.height - ROWS*CELL)/2;

    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const cx = offsetX + x*CELL;
        const cy = offsetY + y*CELL;
        if(maze[y][x]===1){
          ctx.fillStyle = '#333';
        } else if(maze[y][x]===2){
          ctx.fillStyle = '#4caf50';
        } else if(maze[y][x]===3){
          ctx.fillStyle = '#f44336';
        } else {
          ctx.fillStyle = '#fff';
        }
        ctx.fillRect(cx,cy,CELL,CELL);
      }
    }

    // draw player
    const px = offsetX + player.x*CELL + CELL/2;
    const py = offsetY + player.y*CELL + CELL/2;
    ctx.fillStyle = '#003366';
    ctx.beginPath();
    ctx.arc(px,py,CELL/2.4,0,Math.PI*2);
    ctx.fill();
  }

  function startGame(){
    initMaze();
    playing = true;
    startTime = Date.now();
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(()=>{
      timerEl.textContent = Math.floor((Date.now()-startTime)/1000);
    },1000);
    draw();
    startBtn.textContent='Reset Game';
  }
  // End game helper
  function endGame(){
    playing = false;
    if(timerInterval) clearInterval(timerInterval);
    startBtn.textContent='Start New Game';
  }

  // Celebration system
  let celebrating = false;
  let celebrationRaf = null;
  const explosions = [];
  const fireworks = [];
  const confetti = [];
  // Audio
  let audioCtx = null;
  let masterGain = null;

  function ensureAudio(){
    if(audioCtx) return;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      // initialize from UI if available
      const initial = (window.gameAudioVolume !== undefined) ? window.gameAudioVolume : 0.9;
      masterGain.gain.value = initial;
      masterGain.connect(audioCtx.destination);
    }catch(e){
      console.warn('AudioContext not available:', e);
      audioCtx = null;
    }
  }

  // reflect slider updates in real time
  window.addEventListener('game-audio-volume', (e)=>{
    const v = (e && e.detail && typeof e.detail.value === 'number') ? e.detail.value : null;
    if(masterGain && v !== null){ masterGain.gain.setValueAtTime(v, audioCtx.currentTime); }
  });

  // Play a short melodic cheer using simple oscillators
  function playCheer(){
    if(!audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const dur = 0.18;
    const gain = audioCtx.createGain();
    gain.connect(masterGain);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.02);

    notes.forEach((freq, i) => {
      const o = audioCtx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(gain);
      const start = now + i * (dur + 0.02);
      o.start(start);
      o.stop(start + dur);
    });

    // release
    gain.gain.exponentialRampToValueAtTime(0.001, now + notes.length * (dur + 0.02) + 0.15);
    setTimeout(()=>{ gain.disconnect(); }, (notes.length * (dur + 0.02) + 400));
  }

  // Simple boom using filtered noise
  function playBoom(){
    if(!audioCtx) return;
    const now = audioCtx.currentTime;
    const bufferSize = audioCtx.sampleRate * 0.4;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/bufferSize, 2);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filt = audioCtx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 800;
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.001, now);
    src.connect(filt); filt.connect(g); g.connect(masterGain);
    src.start(now);
    g.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    setTimeout(()=>{ src.disconnect(); filt.disconnect(); g.disconnect(); }, 500);
  }

  function rand(min, max){ return Math.random() * (max - min) + min; }

  // Explosion particle
  function createExplosion(x, y, color, count = 60){
    for(let i=0;i<count;i++){
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(2, 8);
      explosions.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.8, 1.6),
        age: 0,
        color
      });
    }
    // play a boom for the explosion
    if(audioCtx) playBoom();
  }

  // Firework that shoots up and explodes
  function createFirework(){
    fireworks.push({
      x: rand(50, canvas.width-50),
      y: canvas.height + 10,
      vx: rand(-1.5, 1.5),
      vy: rand(-10, -7),
      color: `hsl(${Math.floor(rand(0,360))}, 80%, 60%)`,
      exploded: false
    });
  }

  // Confetti pieces
  function createConfetti(count = 80){
    for(let i=0;i<count;i++){
      confetti.push({
        x: rand(0, canvas.width),
        y: rand(-canvas.height*0.5, 0),
        vx: rand(-1, 1),
        vy: rand(1, 4),
        size: rand(4, 10),
        color: `hsl(${Math.floor(rand(0,360))}, 70%, 50%)`,
        rot: rand(0, Math.PI*2),
        rotSpeed: rand(-0.1, 0.1)
      });
    }
  }

  function drawCelebrationBackground(){
    // Dim the maze slightly
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function updateCelebration(dt){
    // Update fireworks
    for(let i = fireworks.length-1; i>=0; i--){
      const f = fireworks[i];
      f.x += f.vx; f.y += f.vy; f.vy += 0.15; // gravity
      // draw small tracer
      ctx.beginPath(); ctx.fillStyle = f.color; ctx.arc(f.x,f.y,2,0,Math.PI*2); ctx.fill();
      if(f.vy >= -2 && !f.exploded){
        f.exploded = true;
        createExplosion(f.x, f.y, f.color, 80);
        fireworks.splice(i,1);
      }
      if(f.y > canvas.height + 50) fireworks.splice(i,1);
    }

    // Update explosions
    for(let i = explosions.length-1; i>=0; i--){
      const p = explosions[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.age += dt;
      const lifeRatio = 1 - (p.age / p.life);
      if(lifeRatio <= 0){ explosions.splice(i,1); continue; }
      ctx.globalAlpha = Math.max(0, lifeRatio);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y, Math.max(1, lifeRatio*4), 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Update confetti
    for(let i = confetti.length-1; i>=0; i--){
      const c = confetti[i];
      c.x += c.vx; c.y += c.vy; c.vy += 0.02; c.rot += c.rotSpeed;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size*0.6);
      ctx.restore();
      if(c.y > canvas.height + 20) confetti.splice(i,1);
    }
  }

  let lastTime = 0;
  function celebrationLoop(ts){
    if(!lastTime) lastTime = ts;
    const dt = (ts - lastTime)/1000;
    lastTime = ts;

    // Draw maze faded under celebration
    draw();
    drawCelebrationBackground();

    // Occasionally spawn fireworks and confetti
    if(Math.random() < 0.12) createFirework();
    if(Math.random() < 0.05) createExplosion(rand(50, canvas.width-50), rand(50, canvas.height*0.6), `hsl(${Math.floor(rand(0,360))}, 80%, 60%)`, Math.floor(rand(30,80)));

    updateCelebration(dt);

    // Big headline
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 6;
    ctx.font = 'bold 42px sans-serif';
    const msg = 'CONGRATULATIONS!';
    const w = ctx.measureText(msg).width;
    ctx.strokeText(msg, (canvas.width-w)/2, canvas.height*0.12);
    ctx.fillText(msg, (canvas.width-w)/2, canvas.height*0.12);
    ctx.restore();

    if(celebrating){
      celebrationRaf = requestAnimationFrame(celebrationLoop);
    } else {
      // finished, redraw maze clean
      draw();
    }
  }

  function startCelebration(durationSeconds = 6){
    if(celebrating) return;
    celebrating = true;
    lastTime = 0;
    createConfetti(120);
    // rapid fireworks at start
    for(let i=0;i<6;i++) createFirework();

    // ensure audio is ready and play a short cheer
    ensureAudio();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if(audioCtx) playCheer();

    celebrationRaf = requestAnimationFrame(celebrationLoop);

    // schedule periodic explosions to make it feel huge
    const explodeInterval = setInterval(()=>{
      createExplosion(rand(80, canvas.width-80), rand(60, canvas.height*0.6), `hsl(${Math.floor(rand(0,360))}, 80%, 60%)`, Math.floor(rand(40,120)));
      createConfetti(30);
    }, 400);

    setTimeout(()=>{
      clearInterval(explodeInterval);
      celebrating = false;
      if(celebrationRaf) cancelAnimationFrame(celebrationRaf);
      celebrationRaf = null;
      // final cleanup and redraw maze
      draw();
      setTimeout(()=> alert('You solved the maze! Great job!'), 80);
    }, durationSeconds * 1000);
  }

  function move(dx,dy){
    if(!playing) return;
    const nx = player.x+dx, ny = player.y+dy;
    if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS && maze[ny][nx]!==1){
      player.x=nx; player.y=ny; draw();
      if(maze[ny][nx]===3){
        const t = Math.floor((Date.now()-startTime)/1000);
        // begin a large celebration
        endGame();
        startCelebration(8);
        console.log(`Solved in ${t}s — celebration started.`);
      }
    }
  }

  document.addEventListener('keydown', (e)=>{
    // Prevent arrow-key scrolling while playing OR celebrating
    if(!playing && !celebrating) return;
    switch(e.key){
      case 'ArrowUp': case 'w': case 'W': 
        e.preventDefault();
        // only move when the game is actively playing
        if(playing) move(0,-1);
        break;
      case 'ArrowDown': case 's': case 'S': 
        e.preventDefault();
        if(playing) move(0,1);
        break;
      case 'ArrowLeft': case 'a': case 'A': 
        e.preventDefault();
        if(playing) move(-1,0);
        break;
      case 'ArrowRight': case 'd': case 'D': 
        e.preventDefault();
        if(playing) move(1,0);
        break;
    }
  });

  startBtn.addEventListener('click', ()=>{
    if(playing) { initMaze(); draw(); startTime=Date.now(); }
    else startGame();
  });

  // change difficulty at runtime
  if(difficultySelect){
    difficultySelect.addEventListener('change', (e)=>{
      const val = e.target.value;
      setDifficultySizes(val);
      // regenerate maze immediately to reflect new difficulty
      initMaze();
      draw();
    });
  }

  // initial draw
  initMaze(); draw();

  // Unlock audio on first user gesture to satisfy autoplay policies
  function unlockAudioOnGesture(){
    ensureAudio();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    document.removeEventListener('click', unlockAudioOnGesture);
    document.removeEventListener('keydown', unlockAudioOnGesture);
  }
  document.addEventListener('click', unlockAudioOnGesture);
  document.addEventListener('keydown', unlockAudioOnGesture);
});
