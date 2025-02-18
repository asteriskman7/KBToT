"use strict";

/*
  TODO:
  confirm mobile support

Fans of true beauty, rejoice, for I bring you [Kristen Bell's Triangle of Transcendence](https://asteriskman7.github.io/KBToT/)!

This game will have you filling in cells like nobody's business and will have true Kristen Bell fanatics feeling like they're on the top of the forking world.

Sure, the game is also based on some [fancy math thing from a dude named Eric](https://en.wikipedia.org/wiki/Bell_triangle) but it's easy to let it go when you've got Kristen "Queen" Bell staring back at you! It's like she's saying, "Listen kiddo, you're doing a great job filling in those cells!"

So, if you're ready to join the ranks of the unhinged Kristen Bell fandom, try [Kristen Bell's Triangle of Transcendence](https://asteriskman7.github.io/KBToT/), embrace the pandemonium and find happiness in the unique insanity of being here, now. Who knows, maybe Kristen herself will see your progress and declare you the ultimate fan!

(This game is mostly idle and will take "a while" but can be completed before the heat death of the universe, unlike some games with "Prestige" in the name.)

*/

class App {
  constructor() {
    this.disableSaves = false;
 
    this.storageKey = 'KBToT';
    this.firstLoad = false;
    this.loadFromStorage();
    this.enableConfetti = false;

    this.rows = 13;
    this.memobn = {'1,1': 1}; //memoization storage for getBellNum
    this.cellList = [];
    this.tickPeriod = 1000;
    this.minLuck = -1.2;
    this.favicons = ['./favicon.png', './faviconAlert.png'];
    this.forceRedraw = true;
    this.findCells = {};
    this.confettiCount = 0;
    this.confettiLimit = 100;
    this.tickPeriod = 1000;

    this.initCells();

    this.initUI();


    this.draw();

    const tickInterval = 1000 / 30;
    const workFraction = 0.5; //TODO: tune this value
    this.tickWorkTime = tickInterval * workFraction;

    setInterval(() => this.tick(), tickInterval);
    setInterval(() => this.saveToStorage(), 5000);

    if (this.firstLoad) {
      this.showModal('helpContainer');
    }
  }

  //get the number in the bell triangle at row n and column k
  //recursive so if you try and calculate a very large number it may exceed the
  //call stack except if you call values from low to high and fill up the 
  //memoization buffer first
  getBellNum(n, k) {
    const m = this.memobn[`${n},${k}`];
    if (m !== undefined) {return m;}

    if (k === 1) {
      const val = this.getBellNum(n - 1, n - 1);
      this.memobn[`${n},${k}`] = val;
      return val;
    }

    const val = this.getBellNum(n, k - 1) + this.getBellNum(n - 1, k - 1);
    this.memobn[`${n},${k}`] = val;
    return val;
  }

  //return the sum of 1/i for i in [1,n]
  //for "large" values of n, use an approximation
  getHarmonic(n) {
    let result;
    //if n is small, calculate directly, otherwise, use approximation
    if (n < 60) {
      result = 0;
      for (let i = 1; i <= n; i++) {
        result += 1 / i;
      }
    } else {
      const gamma = 0.5772156649 //euler-mascheroni constant
      result = (Math.log(n) + gamma);
    }
    return result;
  }

  //return the number of tries it should take, on average, to draw all n values
  getExpectedTries(n) {
    //https://brilliant.org/wiki/coupon-collector-problem/
    return Math.round(this.getHarmonic(n) * n);
  }

  //return the number of additional tries it should take, on average, to draw the values with n total and m already found
  getExpectedRemainingTries(n, m) {
    //via help from Microsoft Copilot
    return Math.round(this.getHarmonic(n - m) * n);
  }

  //return the standard deviation of the number of tries it should take to draw all n values
  //for "large" n, use an approximation
  getStdDev(n) {
    //https://brilliant.org/wiki/coupon-collector-problem/
    let variance;
    if (n < 60) {
      variance = 0;
      for (let i = 1; i <= n; i++) {
        variance += 1 / (i * i);
      }
      variance *= n * n;
      variance -= n * this.getHarmonic(n);
    } else {
      const gamma = 0.5772156649 //euler-mascheroni constant
      variance = (Math.PI * Math.PI * n * n / 6) - n * (Math.log(n) + gamma) - 1/2;
    }
    return Math.sqrt(variance);
  }

  //return the number of standard deviations away from the expected number of attempts
  calcLuck(cell) {
    if (cell.cnt === 1) {return 0;}
    return -(cell.att - cell.exp)/cell.std;
  }

  //calculate number of stddev away from expected number of attempts assuming the
  //remaining attempts will take the expected number of tries
  calcLuckEst(cell) {
    if (cell.cnt === 1) {return 0;}
    const expRemaining = this.getExpectedRemainingTries(cell.cnt, cell.fnd);
    return -(expRemaining + cell.att - cell.exp)/cell.std;
  }

  calcExpTime(cell, restart) {
    const expectedRemainingTries = this.getExpectedRemainingTries(cell.cnt, restart ? 0 : cell.fnd);
    const expectedRemainingTime = expectedRemainingTries * this.tickPeriod;
    return expectedRemainingTime;
  }

  timeToObj(t) {
    const result = {};

    result.y = Math.floor(t / (365 * 24 * 60 * 60));
    t = t % (365 * 24 * 60 * 60);
    result.d = Math.floor(t / (24 * 60 * 60));
    t = t % (24 * 60 * 60);
    result.h = Math.floor(t / (60 * 60));
    t = t % (60 * 60);
    result.m = Math.floor(t / 60);
    t = t % 60;
    result.s = t;

    return result;
  }  

  remainingToStr(ms, full) {
    if (ms === Infinity) {
      return 'Infinity';
    }

    const timeObj = this.timeToObj(ms / 1000);

    if (full) {
      return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}:${timeObj.s.toFixed(1).padStart(4,0)}`;
    }

    //if (timeObj.y > 0 || timeObj.d > 0 || timeObj.h > 0) {
      //return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}`;
      return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}:${Math.ceil(timeObj.s).toString().padStart(2,0)}`;
    //} else {
      //return `${timeObj.m.toString().padStart(2,0)}:${timeObj.s.toFixed(1).padStart(4,0)}`;
    //  return `${timeObj.m.toString().padStart(2,0)}:${Math.ceil(timeObj.s).toString().padStart(2,0)}`;
    //}

  }  

  initCells() {
    this.totalCount = 0;
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        let cell;
        if (this.state.cells[`${row},${col}`] === undefined) {
          const count = this.getBellNum(row, col);
          cell = {
            cnt: count, //count
            att: 0, //attempts
            fnd: 0, //found
            cmp: 0, //complete
            run: 0, //running
            exp: this.getExpectedTries(count), //expected tries
            std: this.getStdDev(count), //stddev of expected tries
            lck: 0, //luck
            upd: 1  //updated
          };
          this.state.cells[`${row},${col}`] = cell;
        } else {
          cell = this.state.cells[`${row},${col}`];
        }

        this.totalCount += cell.cnt;
        cell.upd = 1;

        this.cellList.push(cell);
      }
    }
  }

  createElement(parentElement, type, id, classList, text) {
    const e = document.createElement(type);

    if (id !== undefined && id !== '') {
      e.id = id;
      this.UI[id] = e;
    }

    if (classList !== undefined && classList.length > 0) {
      classList.split(',').forEach( className => {
        e.classList.add(className);
      });
    }

    if (text !== undefined) {
      if (typeof text === 'string' && text.length > 0) {
        e.textContent = text;
      } else if (typeof text === 'number') {
        e.textContent = text;
      }
    }

    if (parentElement !== undefined) {
      parentElement.appendChild(e);
    }

    return e;
  }

  initUI() {
    this.UI = {};

    const staticIDs = 'cellsContainer,resetButton,resetContainer,resetYes,resetNo,imexContainer,imexShow,imexImport,imexExport,imexClose,imexText,infoPlayTime,infoNext,infoTimeRemaining,infoProgress,infoLuckTick,linkIcon,helpButton,helpContainer,helpClose,winContainer,winClose,winPlayTime,infoThreshSlider,infoThreshDisp,infoNextCheck,infoLuckCheck'.split(',');
    staticIDs.forEach( id => {
      this.UI[id] = document.getElementById(id);
    });

    this.UI.resetButton.onclick = () => this.showModal('resetContainer');
    this.UI.resetYes.onclick = () => this.reset();
    this.UI.resetNo.onclick = () => this.closeModal('resetContainer');
    this.UI.imexShow.onclick = () => this.showModal('imexContainer');
    this.UI.imexClose.onclick = () => this.closeModal('imexContainer');
    this.UI.imexImport.onclick = () => this.import();
    this.UI.imexExport.onclick = () => this.export();
    this.UI.helpButton.onclick = () => this.showModal('helpContainer');
    this.UI.helpClose.onclick = () => this.closeModal('helpContainer');
    this.UI.winClose.onclick = () => {
      this.enableConfetti = false;
      this.closeModal('winContainer');
    };
    this.UI.infoThreshSlider.oninput = () => this.threshSliderChange();
    this.UI.infoThreshSlider.value = this.state.threshold;
    this.threshSliderChange();
    this.UI.infoNextCheck.onchange = () => this.nextCheckChange();
    this.UI.infoNextCheck.checked = this.state.any;
    this.UI.infoLuckCheck.onchange = () => this.luckCheckChange();
    this.UI.infoLuckCheck.checked = this.state.est;

    for (let row = 1; row <= this.rows; row++) {
      const rowE = this.createElement(this.UI.cellsContainer, 'div', '', 'row');
      for (let col = 1; col <= row; col++) {
        const cellInfo = this.state.cells[`${row},${col}`];
        const cellC = this.createElement(rowE, 'div', `cell_${row},${col}`, 'cellTop,cellEmpty');
        if (cellInfo.run === 1) {
          cellC.classList.add(cellInfo.cnt % 2 === 0 ? 'cellEven' : 'cellOdd');
        }
        if (col === row) {
          cellC.classList.add('cellRowEnd');
        }
        if (row === 1) {
          cellC.classList.add('cellRowTop');
        }
        if (row === this.rows) {
          if (col === 1) {
            cellC.classList.add('cellRowBotStart');
          }
          if (col === row) {
            cellC.classList.add('cellRowBotEnd');
          }
        }
        const progressClasses = cellInfo.cnt % 2 === 0 ? 'cellProgress,cellProgressEven' : 'cellProgress,cellProgressOdd';
        const cellP = this.createElement(cellC, 'div', `progress_${row},${col}`, progressClasses);
        const cellFGC = this.createElement(cellC, 'div', '', 'cellFGContainer');
        const cellS = this.createElement(cellFGC, 'div', `symbol_${row},${col}`, 'cellFG,cellSymbol', '');
        const cellR = this.createElement(cellFGC, 'div', `run_${row},${col}`, 'cellFG,cellRun', '');
        const cellN = this.createElement(cellFGC, 'div', `num_${row},${col}`, 'cellFG,bellNum', cellInfo.cnt);
        if (row === 1) {
          cellN.style.borderRadius = '7px 0px 0px 0px';
        }
        const cellE = this.createElement(cellFGC, 'div', `exp_${row},${col}`, 'cellFG,cellExp', '');
        const cellI = this.createElement(cellFGC, 'div', `info_${row},${col}`, 'cellFG,cellInfo', '');
        const cellL = this.createElement(cellFGC, 'div', `luck_${row},${col}`, 'cellFG,cellLuck', '');
        const cellT = this.createElement(cellFGC, 'div', `time_${row},${col}`, 'cellFG,cellTime', '');
        if (row === this.rows && col === 1) {
          cellT.style.borderRadius = '0px 0px 0px 7px';
        }
        cellC.onclick = () => this.clickCell(row, col);

        const animation = cellR.animate([
            { transform: 'rotate(0deg)' },
            { transform: 'rotate(90deg)' },
            { transform: 'rotate(180deg)' },
            { transform: 'rotate(270deg)' },
            { transform: 'rotate(360deg)' },
          ], 
          {
            duration: 3000,
            iterations: Infinity
          }
        );
        if (cellInfo.run === 0) {
          animation.pause();
        }
      }
    }
  }

  loadFromStorage() {
    const rawState = localStorage.getItem(this.storageKey);

    this.state = {
      savedTicks: 0,
      cells: {},
      totalLuck: 0,
      threshold: 0,
      any: false,
      est: false
    };

    if (rawState !== null) {
      const loadedState = JSON.parse(rawState);
      this.state = {...this.state, ...loadedState};
    } else {
      this.state.gameStart = (new Date()).getTime();
      this.state.lastTick = this.state.gameStart;
      this.firstLoad = true;
    }

    this.saveToStorage();
  }

  saveToStorage() {
    if (this.disableSaves) {return;}

    const saveString = JSON.stringify(this.state);
    localStorage.setItem(this.storageKey, saveString);
  }

  reset() {
    this.disableSaves = true;
    localStorage.removeItem(this.storageKey);
    window.location.reload();
  }

  genExportStr() {
    this.saveToStorage();

    const saveString = localStorage.getItem(this.storageKey);
    const compressArray = LZString.compressToUint8Array(saveString);
    const exportChars = 'kristenbell'.split``;
    let exportArray = new Array(compressArray.length * 8);
    for (let i = 0; i < compressArray.length; i++) {
      const val = compressArray[i];
      for (let b = 7; b >= 0; b--) {
        const bit = (val & (1 << b)) >> b;
        const cif = (i * 8 + (7 - b)) 
        const ci = cif % exportChars.length;
        const c = (bit === 1) ? exportChars[ci].toUpperCase() : exportChars[ci];
        exportArray[cif] = c;
      }
    }

    return exportArray.join``;

  }

  decodeExportStr(str) {
    const arraySize = Math.round(str.length / 8);
    const compressArray = new Uint8Array(arraySize);
    
    for (let i = 0; i < arraySize; i++) {
      let val = 0;
      for (let b = 7; b >=0; b--) {
        const cif = i * 8 + (7 - b);
        const c = str[cif];
        const bit = c === c.toUpperCase() ? 1 : 0;
        val = val | (bit << b);
      }
      compressArray[i] = val;
    }

    const saveString = LZString.decompressFromUint8Array(compressArray);
    return saveString;    
  }

  export() {
    this.UI.imexText.value = this.genExportStr();
  }

  import() {
    const importString = this.UI.imexText.value.trim();
    if (importString.length % 8 !== 0) {
      console.error("Corrupted import string. Must be multiple of 8 characters long.");
      return;
    }
    const decodedStr = this.decodeExportStr(importString);
    let state;
    try {
      state = JSON.parse(decodedStr);
    } catch (error) {
      console.error("Corrupted import string. JSON.parse check failed.");
      return;
    }

    this.disableSaves = true;
    localStorage.setItem(this.storageKey, decodedStr);
    window.location.reload();  
  }

  //convert a float into a string with d decimal places, rounding down
  floorDigits(v, d) {
    const scale = Math.pow(10, d);
    return (Math.floor(v * scale) / scale).toFixed(d); 
  }

  //from https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  shuffleArray(array) {
    for (let i = array.length - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }

  draw() {
    let minTimeRemaining = Infinity;
    let totalTimeRemaining = 0;
    let completeCount = 0;
    let incompleteClickable = false;
    let celli = -1;
    const confetti = [];
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        celli++;
        const RC = `${row},${col}`;
        const cell = this.state.cells[RC]
        completeCount += cell.cmp === 1 ? cell.cnt : cell.fnd;
        const expTime = cell.run === 1 ? this.calcExpTime(cell) : this.calcExpTime(cell, true);
        totalTimeRemaining += cell.cmp === 0 ? expTime : 0;
        if (cell.run === 1) {
          if (this.state.any || cell.cmp === 0) {
            minTimeRemaining = Math.min(minTimeRemaining, expTime);
          }
        }

        const clickable = this.isCellClickable(row, col);
        const cellE = this.UI[`cell_${RC}`];
        if (clickable) {
          cellE.style.cursor = 'default';
          cellE.classList.add(cell.cnt % 2 === 0 ? 'cellEven' : 'cellOdd');
        } else {
          cellE.style.cursor = 'not-allowed';
        }

        incompleteClickable = incompleteClickable || (cell.cmp === 0 && clickable);

        //only do remaining cell specific DOM actions if this cell has been updated
        if (cell.upd === 0 && !this.forceRedraw) {continue;}
        cell.upd = 0;

        if (this.findCells[celli] === true) {
          const rect = cellE.getBoundingClientRect();
          const confettiCount = 5;
          for (let i = 0; i < confettiCount; i++) {
            confetti.push({cell: cellE, x: (rect.left + rect.right) * 0.5, y: (rect.top + rect.bottom) * 0.5});
          }
        }

        const expectedValueStr = cell.exp.toFixed(0);
        const attStr = cell.att.toFixed(0);
        //\u00A0 turns into nbsp without needing to use innerText instead of textContent
        const attStrPadding = '\u00A0'.repeat(Math.max(0, expectedValueStr.length - attStr.length));
        this.UI[`exp_${RC}`].textContent = expectedValueStr;
        this.UI[`info_${RC}`].textContent = `${attStrPadding}${attStr} : ${cell.cnt - cell.fnd}`;
        const percent = 100 * cell.fnd / cell.cnt;
        this.UI[`progress_${RC}`].style.width = `${percent}%`;

        this.redrawLuck(cell, RC);

        if (cell.run === 1) {
          this.UI[`run_${RC}`].style.display = 'block';
          this.UI[`run_${RC}`].getAnimations()[0].play();
        } else {
          this.UI[`run_${RC}`].style.display = 'none';
          this.UI[`run_${RC}`].getAnimations()[0].pause();
        }
          
        this.UI[`time_${RC}`].textContent = this.remainingToStr(expTime);

      }
    }

    //create a random set of desired confetti without going over the confetti limit
    this.shuffleArray(confetti);
    for (let i = 0; i < confetti.length; i++) {
      if (this.confettiCount >= this.confettiLimit) {break;}
      const c = confetti[i];
      this.createConfetti(c.cell, c.x, c.y);
    }

    this.findCells = {};


    //game win condition
    if (this.state.cells[`${this.rows},${this.rows}`].cmp === 1 && this.state.endTime === undefined) {
      this.state.endTime = (new Date()).getTime();
      const playTime = this.state.endTime - this.state.gameStart;
      this.UI.winPlayTime.textContent = this.remainingToStr(playTime, true);
      this.showModal('winContainer');
      this.enableConfetti = true;
      this.saveToStorage();
    }

    this.forceRedraw = false;
    
    //update infobox
    const curTime = (new Date()).getTime();
    if (this.state.endTime === undefined) {
      this.UI.infoPlayTime.textContent = this.remainingToStr(curTime - this.state.gameStart, true);
    } else {
      this.UI.infoPlayTime.textContent = this.remainingToStr(this.state.endTime - this.state.gameStart, true);
    }
    const minTimeRemainingStr = this.remainingToStr(minTimeRemaining);
    this.UI.infoNext.textContent = minTimeRemainingStr;
    this.UI.infoTimeRemaining.textContent = this.remainingToStr(totalTimeRemaining);
    this.UI.infoLuckTick.textContent = `${this.floorDigits(this.state.totalLuck, 2)} / ${this.floorDigits(this.tickPeriod, 3)} ms${this.state.savedTicks > 10 ? ' +' : ''}`;

    
    const percent = 100 * completeCount / this.totalCount;
    this.UI.infoProgress.style.width = `${percent}%`;

    //update favicon
    const icon = this.favicons[+incompleteClickable];
    if (this.UI.linkIcon.href !== icon) {
      this.UI.linkIcon.href = icon;
    }

    document.title = `Kristen Bell's Triangle of Transcendence - ${minTimeRemainingStr}`;

    window.requestAnimationFrame(() => this.draw());
  }

  processTick() {
    this.cellList.forEach( (cell, i) => {
      if (cell.run === 0) {return;}

      cell.upd = 1;
      const rndVal = Math.random();
      const thresh = (cell.cnt - cell.fnd) / cell.cnt;
      cell.att += 1;
      if (rndVal <= thresh) {
        cell.fnd += 1;
        this.findCells[i] = true;
      }

      if (cell.fnd >= cell.cnt) {
        cell.cmp = 1;
        cell.run = 0;
        this.state.totalLuck -= cell.lck * cell.cnt;
        cell.lck = Math.max(this.minLuck, this.calcLuck(cell));
        this.state.totalLuck += cell.lck * cell.cnt;
        this.tickPeriod = this.getTickPeriod();
        this.forceRedraw = true;
      }
    });
  }

  getTickPeriod() {
    /*
      f(0) = 1000
      f(max) = 5.2937
      the function is linear with respect to the luckPow power of total luck
    */
    
    const basePeriod = 1000;
    const minPeriod = 5.2937; //targets 30 days for final cell 
    const totalCountPre = 163254884; //total count including everything but the last cell
    const targetLuck = 0.75; //equation calibrated for this luck value on all completed cells
    const maxLuck = totalCountPre * targetLuck;
    const baseLuck = 0;
    const slope = (minPeriod - basePeriod) / (maxLuck - baseLuck);
    const luckPow = 0.05385; //with this value, the total run time, if everything is at luck of 0.75 is 5 years
    const invPowMaxLuck = Math.pow(maxLuck, 1 - luckPow);
    const boundTotalLuck = Math.max(0, this.state.totalLuck);
    const calcPeriod = basePeriod + slope * Math.pow(boundTotalLuck, luckPow) * invPowMaxLuck; 
    return Math.max(1, calcPeriod);
  }

  tick() {
    this.tickPeriod = this.getTickPeriod();
    let curTime = (new Date()).getTime();
    const sleepTime = curTime - this.state.lastTick;
    let missingTicks = this.state.savedTicks + sleepTime / this.tickPeriod;
    const stopTime = curTime + this.tickWorkTime;
    const maxTicksPerCycle = 10000;
    this.findCells = {};

    if (this.enableConfetti) {
      const rect = this.UI.winContainer.getBoundingClientRect();
      const xl = rect.left;
      const xr = rect.right;
      const yt = rect.top;
      const yb = rect.bottom;
      const confettiCount = 10;
      const confettiChance = 0.1;
      const confettiParent = this.UI.winContainer;
      if (Math.random() < confettiChance) {
        for (let i = 0; i < confettiCount; i++) {
          this.createConfetti(confettiParent, xl, yt); 
        }
      }
      if (Math.random() < confettiChance) {
        for (let i = 0; i < confettiCount; i++) {
          this.createConfetti(confettiParent, xl, yb); 
        }
      }
      if (Math.random() < confettiChance) {
        for (let i = 0; i < confettiCount; i++) {
          this.createConfetti(confettiParent, xr, yt); 
        }
      }
      if (Math.random() < confettiChance) {
        for (let i = 0; i < confettiCount; i++) {
          this.createConfetti(confettiParent, xr, yb); 
        }
      }
    }

    //try and process as many ticks as possible without taking too long
    while (missingTicks >= 1 && curTime < stopTime) {
      //process maxTicksPerCycle since the overhead of checking after each tick
      //  is probably a lot vs the expense of just processing a tick
      for (let i = 0; i < maxTicksPerCycle; i++) {
        this.processTick();
        missingTicks -= 1;
        if (missingTicks < 1) {
          break;
        }
      }
      curTime = (new Date()).getTime();
    }
    
    this.state.lastTick = curTime;
    this.state.savedTicks = missingTicks;
  }

  showModal(id) {
    this.UI[id].showModal();
  }

  closeModal(id) {
    this.UI[id].close();
  }

  startCell(cellInfo) {
    cellInfo.att = 0;
    cellInfo.fnd = 0;
    cellInfo.run = 1;
  }

  isCellClickable(row, col) {
    const cellInfo = this.state.cells[`${row},${col}`];
    if (cellInfo.run !== 0) {return false;}

    if (row === 1 && col === 1) {return true;}

    const depRow = col === 1 ? row - 1 : row;
    const depCol = col === 1 ? row - 1 : col - 1;
    const depCellInfo = this.state.cells[`${depRow},${depCol}`];
    return depCellInfo.cmp === 1;
  }

  clickCell(row, col) {
    if (this.isCellClickable(row, col)) {
      const cellInfo = this.state.cells[`${row},${col}`];
      this.startCell(cellInfo);
    }
  }

  createConfetti(confettiParent, x, y) {
    if (this.confettiCount >= this.confettiLimit && !this.enableConfetti) {return;}
    this.confettiCount += 1;

    const confetti = document.createElement('div');
    confetti.classList.add('confetti');
    confettiParent.appendChild(confetti);

    const angle = 2 * Math.PI * Math.random();
    const distance = 150;
    const dx = distance * Math.cos(angle);
    const dy = distance * Math.sin(angle);
    const h = Math.random() * 360;
    confetti.style.backgroundColor = `hsl(${h}, 100%, 50%)`;
    confetti.style.backgroundColor = Math.random() < 0.5 ? 'var(--cell-bg-even)' : 'var(--cell-bg-odd)';

    const animation = confetti.animate([
      {
        transform: `translate(${x}px, ${y}px)`,
        opacity: 1
      },
      {
        transform: `translate(${x + dx}px, ${y + dy}px)`,
        opacity: 0
      }
    ], {
      duration: 1000 + Math.random() * 1000,
      easing: 'cubic-bezier(0.34, .79, .32, .99)',
      delay: Math.random() * 200
    });

    animation.onfinish = () => {
      this.confettiCount -= 1;
      confetti.remove();
    };
  }

  threshSliderChange() {
    const sliderValStr = this.UI.infoThreshSlider.value;
    this.UI.infoThreshDisp.textContent = sliderValStr;
    this.state.threshold = parseFloat(sliderValStr);
    this.forceRedraw = true;;
  }

  nextCheckChange() {
    const checkVal = this.UI.infoNextCheck.checked;
    this.state.any = checkVal;
  }

  redrawLuck(cell, RC) {
    let baseLuck;
    if (this.state.est) {
      baseLuck = this.calcLuckEst(cell);
    } else {
      baseLuck = this.calcLuck(cell);
    }

    if (baseLuck < this.minLuck) {
      this.UI[`luck_${RC}`].textContent = `${this.floorDigits(this.minLuck, 2)} (${this.floorDigits(baseLuck, 2)})`;
    } else {
      this.UI[`luck_${RC}`].textContent = `${this.floorDigits(baseLuck, 2)}`
    }
    this.UI[`symbol_${RC}`].style.display = (cell.cnt > 1) && (baseLuck < this.state.threshold) ? 'block' : 'none';
  }

  redrawAllLuck() {
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        const RC = `${row},${col}`;
        const cell = this.state.cells[RC];
        this.redrawLuck(cell, RC);
      }
    }
  }

  luckCheckChange() {
    const checkVal = this.UI.infoLuckCheck.checked;
    this.state.est = checkVal;
    this.redrawAllLuck();
  }

}

const app = new App();



/*
Below is pieroxy's LZString and license
*/

/*
MIT License

Copyright (c) 2013 pieroxy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",e={};function t(r,o){if(!e[r]){e[r]={};for(var n=0;n<r.length;n++)e[r][r.charAt(n)]=n}return e[r][o]}var i={compressToBase64:function(r){if(null==r)return"";var n=i._compress(r,6,function(r){return o.charAt(r)});switch(n.length%4){default:case 0:return n;case 1:return n+"===";case 2:return n+"==";case 3:return n+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(n){return t(o,r.charAt(n))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(r){return null==r?"":""==r?null:i._decompress(r.length,16384,function(o){return r.charCodeAt(o)-32})},compressToUint8Array:function(r){for(var o=i.compress(r),n=new Uint8Array(2*o.length),e=0,t=o.length;e<t;e++){var s=o.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null==o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;e<t;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(r){return null==r?"":i._compress(r,6,function(r){return n.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(o){return t(n,r.charAt(o))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(r,o,n){if(null==r)return"";var e,t,i,s={},u={},a="",p="",c="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<r.length;i+=1)if(a=r.charAt(i),Object.prototype.hasOwnProperty.call(s,a)||(s[a]=f++,u[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(s,p))c=p;else{if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++),s[p]=f++,c=String(a)}if(""!==c){if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==o-1){d.push(n(m));break}v++}return d.join("")},decompress:function(r){return null==r?"":""==r?null:i._decompress(r.length,32768,function(o){return r.charCodeAt(o)})},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module?module.exports=LZString:"undefined"!=typeof angular&&null!=angular&&angular.module("LZString",[]).factory("LZString",function(){return LZString});

