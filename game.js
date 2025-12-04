game.js
/* game.js - GamePie complete engine
   - 10 progressive levels (Cat Mario style)
   - end-level pole sequence -> pick up girl -> carry to car
   - level 10: Golruk throws 50 drinks from right (physics), must dodge all
   - supports touch, keyboard, save/load, PWA service worker
   - Put music files in assets/music/ (music_normal.mp3, music_final.mp3)
   - Optional sprites in assets/sprites/
*/

(() => {
  // Canvas setup (virtual resolution)
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const VIRTUAL_W = 1200;
  const VIRTUAL_H = 680;

  function fitCanvasToWindow(){
    // keep fixed virtual resolution, scale CSS to fit width
    const maxWidth = Math.min(window.innerWidth - 16, VIRTUAL_W);
    const scale = maxWidth / VIRTUAL_W;
    canvas.width = VIRTUAL_W;
    canvas.height = VIRTUAL_H;
    canvas.style.width = Math.round(VIRTUAL_W * scale) + 'px';
    canvas.style.height = Math.round(VIRTUAL_H * scale) + 'px';
  }
  window.addEventListener('resize', fitCanvasToWindow);
  fitCanvasToWindow();

  // Controls & UI
  const overlay = document.getElementById('overlay');
  const menu = document.getElementById('menu');
  const newBtn = document.getElementById('newBtn');
  const contBtn = document.getElementById('contBtn');
  const saveBtn = document.getElementById('saveBtn');
  const hud = document.getElementById('hud');
  const levelInfo = document.getElementById('levelInfo');
  const scoreInfo = document.getElementById('scoreInfo');
  const heartInfo = document.getElementById('heartInfo');
  const finalScreen = document.getElementById('finalScreen');
  const imageInput = document.getElementById('imageInput');
  const finalPhotoBox = document.getElementById('finalPhotoBox');
  const restartBtn = document.getElementById('restartBtn');

  // Audio
  const bgm = document.getElementById('bgm');           // normal music (loop)
  const bgm_final = document.getElementById('bgm_final'); // final level music
  // ensure muted to avoid autoplay blocking; will play on interaction
  bgm.volume = 0.6; bgm_final.volume = 0.7;

  // Game constants
  const MAX_LEVEL = 10;
  let currentLevel = 1;
  let score = 0;
  let heartsCollected = 0;
  let playing = false;
  let cameraX = 0;
  let levelLength = 2200; // base; increases by level
  const GRAV = 1.0;

  // Player
  const player = {
    x: 100, y: VIRTUAL_H - 160, w:46, h:62,
    vx:0, vy:0, onGround:false, facing:1
  };

  // World containers (recreated per level)
  let platforms = [];   // {x,y,w,h, type?}
  let traps = [];       // hidden traps (Cat Mario style): {x,y,w,h,active}
  let hearts = [];      // collectibles
  let enemies = [];     // enemies and Golruk
  let drinks = [];      // only used in last level
  let pole = null;      // pole object at level end
  let girl = null;      // girl at pole

  // Input
  let keys = {};
  window.addEventListener('keydown', e => { keys[e.key] = true; if(e.key===' '){ e.preventDefault(); }});
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  // Touch buttons
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const jumpBtn = document.getElementById('jumpBtn');
  let touch = { left:false, right:false, up:false };
  leftBtn.addEventListener('touchstart', e=>{ e.preventDefault(); touch.left=true; });
  leftBtn.addEventListener('touchend', e=>{ e.preventDefault(); touch.left=false; });
  rightBtn.addEventListener('touchstart', e=>{ e.preventDefault(); touch.right=true; });
  rightBtn.addEventListener('touchend', e=>{ e.preventDefault(); touch.right=false; });
  jumpBtn.addEventListener('touchstart', e=>{ e.preventDefault(); touch.up=true; setTimeout(()=>touch.up=false,160); });

  // Helpers: collision AABB
  function collide(a,b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Save / Load
  function saveGame(){
    const data = { currentLevel, score, heartsCollected, playerX:player.x, playerY:player.y };
    localStorage.setItem('gamepie_save', JSON.stringify(data));
    alert('Game saved locally.');
  }
  function loadGame(){
    const raw = localStorage.getItem('gamepie_save');
    if(!raw){ alert('No save found.'); return; }
    const d = JSON.parse(raw);
    currentLevel = d.currentLevel || 1;
    score = d.score || 0;
    heartsCollected = d.heartsCollected || 0;
    player.x = d.playerX || 100;
    player.y = d.playerY || VIRTUAL_H - 160;
    startLevel(currentLevel);
  }

  // Buttons
  newBtn.onclick = ()=> { startNewGame(); };
  saveBtn.onclick = ()=> { saveGame(); };
  contBtn.onclick = ()=> { loadGame(); };
  restartBtn.onclick = ()=> { finalScreen.classList.add('hidden'); overlay.style.display='flex'; menu.style.display='block'; };

  // Start new
  function startNewGame(){
    currentLevel = 1; score = 0; heartsCollected = 0;
    overlay.style.display='none';
    hud.classList.remove('hidden');
    tryPlayBgm();
    startLevel(currentLevel);
  }

  // Ensure audio plays after user interaction
  function tryPlayBgm(){
    bgm.play().catch(()=>{/* will play on next user interaction*/});
  }
  canvas.addEventListener('pointerdown', ()=> { tryPlayBgm(); });

  // Level builder
  function startLevel(n){
    // reset world
    platforms = []; traps = []; hearts = []; enemies = []; drinks = []; pole=null; girl=null;
    playing = true;
    cameraX = 0;
    levelLength = 1800 + (n-1)*240; // progressively longer
    // floor
    platforms.push({ x:0, y:VIRTUAL_H - 100, w: levelLength, h: 100, type:'floor' });

    // Add random platforms and traps (Cat Mario style)
    const platformCount = 6 + Math.floor(n*1.2);
    for(let i=0;i<platformCount;i++){
      const w = 140 + Math.floor(Math.random()*260);
      const x = 200 + i*(levelLength/platformCount) + Math.random()*80;
      const y = VIRTUAL_H - 160 - Math.random()*300;
      platforms.push({ x,y,w,h:18 });
      // occasional trap below platform (hidden)
      if(Math.random() < 0.35 + n*0.02){
        traps.push({ x: x + Math.random()*(w-40), y: y+18, w:36, h:28, active:true, type:'spike' });
      }
    }

    // collectibles (hearts)
    const heartsNum = 3 + Math.floor(n * 1.3);
    for(let i=0;i<heartsNum;i++){
      const x = 240 + Math.random()*(levelLength - 600);
      const y = VIRTUAL_H - 160 - Math.random()*320;
      hearts.push({ x, y, w:28, h:28, collected:false });
    }

    // enemies: simple walking hazards
    const enemyCount = Math.max(1, Math.floor(n/2));
    for(let i=0;i<enemyCount;i++){
      const ex = 400 + i*(levelLength/(enemyCount+1)) + Math.random()*160;
      enemies.push({ x:ex, y: VIRTUAL_H - 160, w:48, h:48, dir: (Math.random()>0.5?1:-1), speed: 1 + n*0.12, type:'walker' });
    }

    // place pole & girl at end
    const poleX = levelLength - 220;
    pole = { x: poleX, y: VIRTUAL_H - 100 - 220, w:8, h:220 };
    platforms.push(pole);
    girl = { x: poleX - 10, y: VIRTUAL_H - 100 - 40, w:36, h:48, grabbed:false, type:'girl' };
    hearts.push(girl); // treat as collectible but special

    // last level special: Golruk
    if(n === MAX_LEVEL){
      // place Golruk near end; she'll throw drinks
      enemies.push({ x: levelLength - 120, y: VIRTUAL_H - 100 - 220, w:160, h:200, type:'golruk', thrown:0, cooldown:10 });
    }

    // reset player pos
    player.x = 120; player.y = VIRTUAL_H - 160; player.vx = 0; player.vy = 0; player.onGround = false;

    // swap music
    if(n === MAX_LEVEL){
      try{ bgm.pause(); bgm_final.currentTime = 0; bgm_final.play(); } catch(e) {}
    } else {
      try{ bgm_final.pause(); bgm.currentTime = 0; bgm.play(); } catch(e) {}
    }

    updateHUD();
    loop();
  }

  // HUD
  function updateHUD(){
    levelInfo.innerText = `Level ${currentLevel} / ${MAX_LEVEL}`;
    scoreInfo.innerText = `Score: ${score}`;
    heartInfo.innerText = `Hearts: ${heartsCollected}`;
  }

  // physics & movement
  function applyPlayerControls(){
    let moveLeft = keys['ArrowLeft'] || keys['a'] || touch.left;
    let moveRight = keys['ArrowRight'] || keys['d'] || touch.right;
    // horizontal
    const speed = 5;
    if(moveLeft){ player.vx = -speed; player.facing = -1; }
    else if(moveRight){ player.vx = speed; player.facing = 1; }
    else{ player.vx = 0; }

    // jump
    const jumpPressed = keys['ArrowUp'] || keys['w'] || touch.up || keys[' '];
    if(jumpPressed && player.onGround){
      player.vy = -18;
      player.onGround = false;
    }

    // apply gravity
    player.vy += GRAV;
    player.x += player.vx;
    player.y += player.vy;

    // floor/platform collisions
    player.onGround = false;
    for(const p of platforms){
      if(player.x + player.w > p.x && player.x < p.x + p.w){
        if(player.y + player.h > p.y && player.y + player.h < p.y + p.h + 36 && player.vy >=0){
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        }
      }
    }

    // world bounds horizontally
    if(player.x < 0) player.x = 0;
    if(player.x + player.w > levelLength) player.x = levelLength - player.w;

    // camera follows player (clamp)
    const margin = 360;
    const targetCam = Math.min(Math.max(player.x - margin, 0), levelLength - VIRTUAL_W);
    cameraX += (targetCam - cameraX) * 0.22;
  }

  // update enemies, traps, drinks
  function updateWorld(){
    // enemy movement
    for(const e of enemies){
      if(e.type === 'walker'){
        e.x += e.dir * e.speed;
        if(e.x < 80) e.dir = 1;
        if(e.x + e.w > levelLength - 80) e.dir = -1;
      } else if(e.type === 'golruk'){
        e.cooldown--;
        if(e.cooldown <= 0 && e.thrown < 50){
          e.cooldown = 8 + Math.floor(Math.random()*16);
          // spawn drink with initial leftwards and up velocity
          const d = {
            x: e.x - 20,
            y: e.y + 60 + Math.random()*40,
            w:18, h:18,
            vx: -6 - Math.random()*4,
            vy: -8 - Math.random()*3,
            gravity: 0.45
          };
          drinks.push(d);
          e.thrown++;
        }
      }
    }

    // update drinks physics
    for(let i = drinks.length -1; i>=0; i--){
      const d = drinks[i];
      d.vy += d.gravity;
      d.x += d.vx;
      d.y += d.vy;
      // if passed left of camera (off-screen) remove
      if(d.x + d.w < cameraX){
        drinks.splice(i,1);
      } else if(collide(d, player)){
        // hit player -> restart level
        playing = false;
        showTemporaryMessage('Colpito! Riprova il livello', 1000, ()=> startLevel(currentLevel));
        return;
      }
    }

    // traps: if player overlaps a hidden trap -> immediate fail
    for(const t of traps){
      if(t.active && collide(player, t)){
        // immediate fail
        playing = false;
        showTemporaryMessage('Trappola! Riprova', 900, ()=> startLevel(currentLevel));
        return;
      }
    }

    // enemy collision (non-golruk)
    for(const e of enemies){
      if(e.type === 'walker' && collide(e, player)){
        playing = false;
        showTemporaryMessage('Colpito! Riprova', 900, ()=> startLevel(currentLevel));
        return;
      }
    }

    // collectibles
    for(const c of hearts){
      if(!c.collected && collide(c, player)){
        if(c.type === 'girl'){
          // reaching girl doesn't auto-complete: must reach pole top to trigger pole sequence
          // but we can flag collected here
          c.collected = true;
        } else {
          c.collected = true;
          heartsCollected++;
          score += 100;
        }
      }
    }

    // check level end for non-final: if player x beyond pole.x - 20 -> trigger pole seq
    if(pole && player.x > pole.x - 24 && currentLevel < MAX_LEVEL){
      playing = false;
      // player reached pole; start pole sequence (normal)
      setTimeout(()=> showPoleSequence(false), 120);
    }

    // check final level completion: Golruk thrown all 50 and drinks array empty -> success
    if(currentLevel === MAX_LEVEL){
      const g = enemies.find(x=>x.type==='golruk');
      if(g && g.thrown >= 50 && drinks.length === 0){
        // success: go to pole sequence final=true
        playing = false;
        setTimeout(()=> showPoleSequence(true), 300);
      }
    }
  }

  // temporary message helper
  function showTemporaryMessage(text, ms=1000, cb){
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(cameraX + 120, 200, 600, 80);
    ctx.fillStyle='#fff'; ctx.font='28px Arial';
    ctx.fillText(text, cameraX + 160, 250);
    setTimeout(()=>{ if(cb) cb(); }, ms);
  }

  // pole (end-of-level) animation: final=true for last level success behavior
  function showPoleSequence(final){
    // animate player jump to pole top, grab girl, walk to car, then next level or final screen
    const poleX = pole.x;
    const poleTopY = pole.y - player.h + 6;
    const startX = player.x;
    const startY = player.y;
    let t = 0;
    const tMax = 90;

    // ensure girl object reference
    const theGirl = hearts.find(x=>x.type==='girl');

    function animJump(){
      ctx.clearRect(0,0,VIRTUAL_W,VIRTUAL_H);
      drawWorldStatic();

      // ease
      const k = Math.min(1, t / tMax);
      // move player toward pole top
      player.x = startX + (poleX - startX) * k;
      // arc for y
      player.y = startY + (poleTopY - startY) * k - Math.sin(k * Math.PI) * 80;
      // draw player (relative to camera)
      ctx.fillStyle='cyan';
      ctx.fillRect(player.x - cameraX, player.y, player.w, player.h);

      // draw girl if not grabbed
      if(theGirl && !theGirl.grabbed){
        ctx.fillStyle='pink';
        ctx.fillRect(theGirl.x - cameraX, theGirl.y, theGirl.w, theGirl.h);
      } else if(theGirl && theGirl.grabbed){
        ctx.fillStyle='pink';
        ctx.fillRect(player.x - cameraX, player.y - 36, theGirl.w, theGirl.h);
      }

      t++;
      if(t <= tMax){
        requestAnimationFrame(animJump);
      } else {
        // mark grabbed
        if(theGirl) theGirl.grabbed = true;
        // proceed to walk to car
        setTimeout(()=> walkToCar(), 220);
      }
    }

    function walkToCar(){
      const carX = poleX + 200;
      const startWalkX = player.x;
      const dist = carX - startWalkX - 40;
      const steps = 160;
      let s = 0;
      function w(){
        const k = s / steps;
        player.x = startWalkX + dist * k;
        ctx.clearRect(0,0,VIRTUAL_W,VIRTUAL_H);
        drawWorldStatic();
        // draw player + girl
        ctx.fillStyle='cyan';
        ctx.fillRect(player.x - cameraX, player.y, player.w, player.h);
        if(theGirl && theGirl.grabbed){
          ctx.fillStyle='pink';
          ctx.fillRect(player.x - cameraX, player.y - 36, theGirl.w, theGirl.h);
        }
        // draw car
        ctx.fillStyle='silver';
        ctx.fillRect(carX - cameraX, VIRTUAL_H - 160, 140, 72);
        s++;
        if(s <= steps) requestAnimationFrame(w);
        else finishLevel(final);
      }
      requestAnimationFrame(w);
    }

    animJump();
  }

  function finishLevel(final){
    // award score
    score += 500 + Math.floor(Math.random() * 200);
    updateHUD();
    if(final){
      // final victory
      showFinalScreen();
    } else {
      // next level
      currentLevel = Math.min(MAX_LEVEL, currentLevel + 1);
      startLevel(currentLevel);
    }
  }

  function showFinalScreen(){
    // show "Pie diventa King" and reveal finalScreen for image upload
    // stop music
    try{ bgm_final.pause(); }catch(e){}
    finalScreen.classList.remove('hidden');
  }

  // draw static world (used by animations)
  function drawWorldStatic(){
    // background
    ctx.fillStyle = '#0c0c12';
    ctx.fillRect(0,0,VIRTUAL_W,VIRTUAL_H);

    // platforms
    ctx.fillStyle = '#333';
    for(const p of platforms){
      ctx.fillRect(p.x - cameraX, p.y, p.w, p.h);
    }

    // hearts/girl
    for(const c of hearts){
      if(c.type === 'girl'){
        if(!c.grabbed){
          ctx.fillStyle='pink';
          ctx.fillRect(c.x - cameraX, c.y, c.w, c.h);
        }
      } else if(!c.collected){
        ctx.fillStyle='red';
        ctx.fillRect(c.x - cameraX, c.y, c.w, c.h);
      }
    }

    // enemies
    for(const e of enemies){
      if(e.type === 'golruk'){
        ctx.fillStyle='purple';
        ctx.fillRect(e.x - cameraX, e.y, e.w, e.h);
      } else {
        ctx.fillStyle='orange';
        ctx.fillRect(e.x - cameraX, e.y, e.w, e.h);
      }
    }

    // car
    if(pole){
      const carX = pole.x + 200;
      ctx.fillStyle='silver';
      ctx.fillRect(carX - cameraX, VIRTUAL_H - 160, 140, 72);
    }

    // player placeholder (for context)
    ctx.fillStyle='cyan';
    ctx.fillRect(player.x - cameraX, player.y, player.w, player.h);
  }

  // main draw loop
  let rafId = null;
  function loop(){
    if(!playing) return;
    applyPlayerControls();
    updateWorld();

    // clear
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0,0,VIRTUAL_W,VIRTUAL_H);

    // draw parallax background (discoteca bg) if image exists: skip image code here for simplicity

    // draw platforms
    ctx.fillStyle='#444';
    for(const p of platforms){
      ctx.fillRect(p.x - cameraX, p.y, p.w, p.h);
    }

    // traps: hidden, do not draw (can draw faint markers for debug)
    // draw hearts
    for(const c of hearts){
      if(c.type === 'girl'){
        if(!c.grabbed){
          ctx.fillStyle='pink';
          ctx.fillRect(c.x - cameraX, c.y, c.w, c.h);
        }
      } else if(!c.collected){
        ctx.fillStyle='red';
        ctx.fillRect(c.x - cameraX, c.y, c.w, c.h);
      }
    }

    // draw enemies
    for(const e of enemies){
      if(e.type === 'golruk'){
        ctx.fillStyle='purple';
        ctx.fillRect(e.x - cameraX, e.y, e.w, e.h);
      } else {
        ctx.fillStyle='orange';
        ctx.fillRect(e.x - cameraX, e.y, e.w, e.h);
      }
    }

    // draw drinks (final)
    for(const d of drinks){
      ctx.fillStyle='rgba(220,60,80,0.95)';
      ctx.fillRect(d.x - cameraX, d.y, d.w, d.h);
    }

    // draw car at end
    if(pole){
      const carX = pole.x + 200;
      ctx.fillStyle='silver';
      ctx.fillRect(carX - cameraX, VIRTUAL_H - 160, 140, 72);
    }

    // draw player
    ctx.fillStyle='cyan';
    ctx.fillRect(player.x - cameraX, player.y, player.w, player.h);

    // HUD overlay (in-canvas)
    ctx.fillStyle='#fff'; ctx.font='20px Arial';
    ctx.fillText(`Level ${currentLevel}/${MAX_LEVEL}`, 20, 30);
    ctx.fillText(`Score ${score}`, 20, 56);
    ctx.fillText(`Hearts ${heartsCollected}`, 20, 82);

    // final-level debug: drinks thrown
    if(currentLevel === MAX_LEVEL){
      const g = enemies.find(x=>x.type==='golruk');
      ctx.fillText(`Drinks thrown: ${g ? g.thrown : 0}`, VIRTUAL_W - 260, 30);
    }

    updateHUD();

    rafId = requestAnimationFrame(loop);
  }

  // Image upload final screen
  imageInput.addEventListener('change', function(evt){
    const f = evt.target.files[0];
    if(!f) return;
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    finalPhotoBox.innerHTML = '';
    finalPhotoBox.appendChild(img);
  });

  // on load: check for save
  (function onStartup(){
    const raw = localStorage.getItem('gamepie_save');
    if(raw) contBtn.disabled = false; else contBtn.disabled = true;
  })();

  // initial overlay show
  overlay.style.display = 'flex';
  hud.classList.add('hidden');

  // Expose startLevel to global for restart convenience
  window.startLevel = startLevel;
  window.startNewGame = startNewGame;
  window.startFinalScreen = showFinalScreen;
})();
