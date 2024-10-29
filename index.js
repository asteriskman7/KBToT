"use strict";

/*
  TODO:
  make info box work
  handle luck
  allow re-runs
  add images
  add end of game
  add correct mouse cursors
  confirm mobile support
  add import/export
  display info on cells
  process ticks of active cells
  style modal dialogs
*/

class App {
  constructor() {
    this.disableSaves = false;

    this.loadFromStorage();

    this.rows = 13;
    this.memobn = {'1,1': 1}; //memoization storage for getBellNum
    this.runningCells = [];

    this.initCells();

    this.initUI();


    this.draw();

    const tickInterval = 1000 / 30;
    const workFraction = 0.5; //TODO: tune this value
    this.tickWorkTime = tickInterval * workFraction;

    setInterval(() => this.tick(), tickInterval);
    setInterval(() => this.saveToStorage(), 5000);
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

  initCells() {
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        let cell;
        if (this.state.cells[`${row},${col}`] === undefined) {
          cell = {
            cnt: this.getBellNum(row, col), //count
            att: 0, //attempts
            fnd: 0, //found
            cmp: 0, //complete,
            run: 0  //running
          };
          this.state.cells[`${row},${col}`] = cell;
        } else {
          cell = this.state.cells[`${row},${col}`];
        }

        if (cell.run === 1) {
          this.runningCells.push(cell);
        }
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
        e.innerText = text;
      } else if (typeof text === 'number') {
        e.innerText = text;
      }
    }

    if (parentElement !== undefined) {
      parentElement.appendChild(e);
    }

    return e;
  }

  initUI() {
    this.UI = {};

    const staticIDs = 'cellsContainer,resetButton,resetContainer,resetYes,resetNo'.split(',');
    staticIDs.forEach( id => {
      this.UI[id] = document.getElementById(id);
    });

    this.UI.resetButton.onclick = () => this.showModal('resetContainer');
    this.UI.resetYes.onclick = () => this.reset();
    this.UI.resetNo.onclick = () => this.closeModal('resetContainer');

    for (let row = 1; row <= this.rows; row++) {
      const rowE = this.createElement(this.UI.cellsContainer, 'div', '', 'row');
      for (let col = 1; col <= row; col++) {
        const cellInfo = this.state.cells[`${row},${col}`];
        const cellC = this.createElement(rowE, 'div', '', 'cellTop');
        const cellP = this.createElement(cellC, 'div', `progress_${row},${col}`, 'cellProgress');
        const cellN = this.createElement(cellC, 'div', `num_${row},${col}`, 'cellFG,bellNum', cellInfo.cnt);
        const cellL = this.createElement(cellC, 'div', `luck_${row},${col}`, 'cellFG,cellLuck', 'l=+5%');
        const cellT = this.createElement(cellC, 'div', `txt_${row},${col}`, 'cellFG,cellTxt', '53/1321');
        cellC.onclick = () => this.clickCell(row, col);

        if (cellInfo.cnt % 2 === 0) {
          cellC.style.backgroundColor = 'white';
        } else {
          cellC.style.backgroundColor = 'blue';
        }
      }
    }
  }

  loadFromStorage() {
    const rawState = localStorage.getItem('KBToT');

    this.state = {
      savedTicks: 0,
      tickPeriod: 1000, //ms
      cells: {}
    };

    if (rawState !== null) {
      const loadedState = JSON.parse(rawState);
      this.state = {...this.state, ...loadedState};
    } else {
      this.state.gameStart = (new Date()).getTime();
      this.state.lastTick = this.state.gameStart;
    }

    this.saveToStorage();
  }

  saveToStorage() {
    if (this.disableSaves) {return;}

    const saveString = JSON.stringify(this.state);
    localStorage.setItem('KBToT', saveString);
    console.log('saved');
  }

  reset() {
    this.disableSaves = true;
    localStorage.removeItem('KBToT');
    window.location.reload();
  }

  draw() {
    //TODO: don't redraw things that aren't changing
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        const cell = this.state.cells[`${row},${col}`]
        this.UI[`txt_${row},${col}`].innerText = `${cell.att} -> ${cell.fnd}`;
        const percent = 100 * cell.fnd / cell.cnt;
        this.UI[`progress_${row},${col}`].style.width = `${percent}%`;
      }
    }
    

    window.requestAnimationFrame(() => this.draw());
  }

  processTick() {
    this.runningCells = this.runningCells.filter( cell => {
      const rndVal = Math.random();
      const thresh = (cell.cnt - cell.fnd) / cell.cnt;
      cell.att += 1;
      if (rndVal <= thresh) {
        cell.fnd += 1;
        cell.cmp = 1;
      }

      if (cell.fnd >= cell.cnt) {
        cell.cmp = 1;
        cell.run = 0;
        return false;
      }

      return true;
    });
  }

  tick() {
    let curTime = (new Date()).getTime();
    const sleepTime = curTime - this.state.lastTick;
    let missingTicks = this.state.savedTicks + sleepTime / this.state.tickPeriod;
    const stopTime = curTime + this.tickWorkTime;
    const maxTicksPerCycle = 100; //TODO: tune this value

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
    document.querySelector('body').classList.add('blur2px');
    this.UI[id].showModal();
  }

  closeModal(id) {
    this.UI[id].close();
    document.querySelector('body').classList.remove('blur2px');
  }

  startCell(cellInfo) {
    cellInfo.att = 0;
    cellInfo.fnd = 0;
    cellInfo.cmp = 0;
    cellInfo.run = 1;
    this.runningCells.push(cellInfo);
  }

  clickCell(row, col) {
    console.log('click', row, col);
    const cellInfo = this.state.cells[`${row},${col}`];
    if (cellInfo.run === 0) {
      this.startCell(cellInfo);
    }
  }
}

const app = new App();
