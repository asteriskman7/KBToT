"use strict";

/*
  TODO:
  make info box work
  display total luck
  make total luck change tick rate
  add images
  add end of game
  add correct mouse cursors
  confirm mobile support
  display all necessary info on cells nicely
  style modal dialogs
  style main game
*/

class App {
  constructor() {
    this.disableSaves = false;

    this.storageKey = 'KBToT';
    this.loadFromStorage();

    this.rows = 13;
    this.memobn = {'1,1': 1}; //memoization storage for getBellNum
    this.memoe = {}; //memoization storage for getExpectedTries
    this.memos = {}; //memoization storage for getStdDev
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

  getExpectedTries(n) {
    const m = this.memoe[`${n}`];
    if (m !== undefined) {return m;}

    let result = 0;
    for (let i = 1; i <= n; i++) {
      result += 1 / i;
    }
    result *= n;
    result =  Math.round(result);
    this.memoe[`${n}`] = result;
    return result;
  }

  getStdDev(n) {
    const m = this.memos[`${n}`];
    if (m !== undefined) {return m;}

    let variance = 0;
    for (let i = 1; i < n; i++) {
      variance += i / (n - i);
    }
    const stddev = Math.sqrt(variance);
    this.memos[`${n}`] = stddev;
    return stddev;
  }

  calcLuck(cell) {
    if (cell.cnt === 1) {return 0;}
    return -(cell.att - cell.exp)/cell.std;
  }

  initCells() {
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

    const staticIDs = 'cellsContainer,resetButton,resetContainer,resetYes,resetNo,imexContainer,imexShow,imexImport,imexExport,imexClose,imexText'.split(',');
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
    const rawState = localStorage.getItem(this.storageKey);

    this.state = {
      savedTicks: 0,
      tickPeriod: 1000, //ms
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
    console.log('saved');
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
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        const cell = this.state.cells[`${row},${col}`]
        this.UI[`txt_${row},${col}`].innerText = `${cell.att} -> ${cell.fnd} (${cell.exp})`;
        const percent = 100 * cell.fnd / cell.cnt;
        this.UI[`progress_${row},${col}`].style.width = `${percent}%`;
        this.UI[`luck_${row},${col}`].innerText = `${this.calcLuck(cell).toFixed(1)}`
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
      }

      if (cell.fnd >= cell.cnt) {
        cell.cmp = 1;
        cell.run = 0;
        this.state.totalLuck -= cell.lck;
        cell.lck = this.calcLuck(cell);
        this.state.totalLuck += cell.lck;
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
    cellInfo.run = 1;
    this.runningCells.push(cellInfo);
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

