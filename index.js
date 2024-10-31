"use strict";

/*
  TODO:
  display total luck / tick period
  make total luck change tick rate
  add images for cells
  add favicon
  add end of game
  confirm mobile support
  style modal dialogs
  style main game
  provide some kind of help or info to explain mechanics
  make legend for info in cell
  fix cell info display so that att and fnd and exp fit

  the last cell is 27644437 and has expected trials of 489642435. need to determine how long I want it to take and
    set up the tick interval 
  make the last cell take 30 days
  30 days = 30 * 24 * 60 * 60 = 2.592e6 seconds
  max luck should give 188 ticks per second
*/

class App {
  constructor() {
    this.disableSaves = false;

    this.storageKey = 'KBToT';
    this.loadFromStorage();

    this.rows = 13;
    this.memobn = {'1,1': 1}; //memoization storage for getBellNum
    this.cellList = [];

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

  getExpectedTries(n) {
    return Math.round(this.getHarmonic(n) * n);
  }

  getExpectedRemainingTries(n, m) {
    return Math.round(this.getHarmonic(n - m) * n);
  }

  getStdDevOrig(n) {
    //seemingly wrong
    //https://files.eric.ed.gov/fulltext/EJ744035.pdf
    let variance;
    //if n is small, calculate directly, otherwise, use approximation
    if (n < 60) {
      variance = 0;
      for (let i = 1; i < n; i++) {
        variance += i / (n - i);
      }
    } else {
      variance = n * this.getHarmonic(n - 1) - n + 1;
    }
    return Math.sqrt(variance);
  }

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

  calcLuck(cell) {
    if (cell.cnt === 1) {return 0;}
    return -(cell.att - cell.exp)/cell.std;
  }

  calcExpTime(cell) {
    const expectedRemainingTries = this.getExpectedRemainingTries(cell.cnt, cell.fnd);
    const expectedRemainingTime = expectedRemainingTries * this.getTickPeriod();
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
            lck: 0
          };
          this.state.cells[`${row},${col}`] = cell;
        } else {
          cell = this.state.cells[`${row},${col}`];
        }

        this.totalCount += cell.cnt;

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

    const staticIDs = 'cellsContainer,resetButton,resetContainer,resetYes,resetNo,imexContainer,imexShow,imexImport,imexExport,imexClose,imexText,infoPlayTime,infoNext,infoTimeRemaining,infoProgress'.split(',');
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

    for (let row = 1; row <= this.rows; row++) {
      const rowE = this.createElement(this.UI.cellsContainer, 'div', '', 'row');
      for (let col = 1; col <= row; col++) {
        const cellInfo = this.state.cells[`${row},${col}`];
        const cellC = this.createElement(rowE, 'div', `cell_${row},${col}`, 'cellTop');
        const cellP = this.createElement(cellC, 'div', `progress_${row},${col}`, 'cellProgress');
        const cellN = this.createElement(cellC, 'div', `num_${row},${col}`, 'cellFG,bellNum', cellInfo.cnt);
        const cellL = this.createElement(cellC, 'div', `luck_${row},${col}`, 'cellFG,cellLuck', 'l=+5%');
        const cellI = this.createElement(cellC, 'div', `info_${row},${col}`, 'cellFG,cellInfo', '53/1321');
        const cellT = this.createElement(cellC, 'div', `time_${row},${col}`, 'cellFG,cellTime', '53/1321');
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
    const rawState = localStorage.getItem(this.storageKey);

    this.state = {
      savedTicks: 0,
      cells: {},
      totalLuck: 0
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

  draw() {
    //TODO: don't redraw things that aren't changing
    let minTimeRemaining = Infinity;
    let totalTimeRemaining = 0;
    let completeCount = 0;
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        const cell = this.state.cells[`${row},${col}`]
        this.UI[`info_${row},${col}`].textContent = `${cell.att} -> ${cell.fnd} (${cell.exp})`;
        const percent = 100 * cell.fnd / cell.cnt;
        this.UI[`progress_${row},${col}`].style.width = `${percent}%`;
        if (cell.run === 1) {
          this.UI[`luck_${row},${col}`].textContent = `${this.calcLuck(cell).toFixed(1)}`
        } else {
          this.UI[`luck_${row},${col}`].textContent = `${cell.lck.toFixed(1)}`
        }
        if (cell.run === 1 || cell.cmp === 0) {
          const expTime = this.calcExpTime(cell);
          if (cell.cmp === 0) {
            totalTimeRemaining += expTime;
          }
          if (cell.run === 1) {
            minTimeRemaining = Math.min(minTimeRemaining, expTime);
          }
          this.UI[`time_${row},${col}`].textContent = `${this.remainingToStr(expTime)}`;
        } else {
          this.UI[`time_${row},${col}`].textContent = '.'; //TODO: figure out why layout breaks if this is empty on a row where others aren't like when 203 cell is done but the rest of the row isn't
        }

        this.UI[`cell_${row},${col}`].style.cursor = this.isCellClickable(row, col) ? 'default' : 'not-allowed';

        completeCount += cell.fnd;
      }
    }
    
    const curTime = (new Date()).getTime();
    this.UI.infoPlayTime.textContent = this.remainingToStr(curTime - this.state.gameStart, true);
    this.UI.infoNext.textContent = this.remainingToStr(minTimeRemaining);
    this.UI.infoTimeRemaining.textContent = this.remainingToStr(totalTimeRemaining);

    
    const percent = 100 * completeCount / this.totalCount;
    //this.UI.infoProgress.style.width = `${(curTime % 10000) * 100 / 10000}%`;
    this.UI.infoProgress.style.width = `${percent}%`;

    window.requestAnimationFrame(() => this.draw());
  }

  processTick() {
    this.cellList.forEach( cell => {
      if (cell.run === 0) {return;}

      const rndVal = Math.random();
      const thresh = (cell.cnt - cell.fnd) / cell.cnt;
      cell.att += 1;
      if (rndVal <= thresh) {
        cell.fnd += 1;
      }

      if (cell.fnd >= cell.cnt) {
        cell.cmp = 1;
        cell.run = 0;
        this.state.totalLuck -= cell.lck * cell.cnt;
        cell.lck = this.calcLuck(cell);
        this.state.totalLuck += cell.lck * cell.cnt;
      }
    });
  }

  getTickPeriod() {
    /*
      f(0) = 1000
      f(max) = 5.2937
    */
    return 5.2937; //TODO: make a function of this.state.totalLuck
  }

  tick() {
    this.tickPeriod = this.getTickPeriod();
    let curTime = (new Date()).getTime();
    const sleepTime = curTime - this.state.lastTick;
    let missingTicks = this.state.savedTicks + sleepTime / this.tickPeriod;
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
    console.log('click', row, col);
    if (this.isCellClickable(row, col)) {
      const cellInfo = this.state.cells[`${row},${col}`];
      this.startCell(cellInfo);
    }
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

