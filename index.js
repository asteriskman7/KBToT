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
  add reset
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

    this.initCells();

    this.initUI();


    this.draw();

    const tickInterval = 1000 / 30;
    const workFraction = 0.5; //TODO: tune this value
    this.tickWorkTime = tickInterval * workFraction;

    this.val = 0;

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
        if (this.state.cells[`${row},${col}`] === undefined) {
          const cell = {
            cnt: this.getBellNum(row, col), //count
            att: 0, //attempts
            fnd: 0, //found
            cmp: 0  //complete
          };
          this.state.cells[`${row},${col}`] = cell;
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

    if (text !== undefined && text.length > 0) {
      e.innerText = text;
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
        const cellE = this.createElement(rowE, 'div', '', 'cell', `${row},${col}`);
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
  }

  reset() {
    this.disableSaves = true;
    localStorage.removeItem('KBToT');
    window.location.reload();
  }

  draw() {
    document.getElementById('dtest').innerText = `${this.val} saved ${this.state.savedTicks}`;

    window.requestAnimationFrame(() => this.draw());
  }

  processTick() {
    this.val += 1;
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
}

const app = new App();
