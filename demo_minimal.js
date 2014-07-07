// vt100.js is Copyright (C) 2008-2009 Markus Gutschke <markus@shellinabox.com>
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License version 2 as
// published by the Free Software Foundation.

// Cut down demo to the basics by Geoff Howland, 2014

// #define STATE_IDLE     0
// #define STATE_INIT     1
// #define STATE_PROMPT   2
// #define STATE_READLINE 3
// #define STATE_COMMAND  4
// #define STATE_EXEC     5
// #define STATE_NEW_Y_N  6

// #define TYPE_STRING    0
// #define TYPE_NUMBER    1

function extend(subClass, baseClass) {
  function inheritance() { }
  inheritance.prototype          = baseClass.prototype;
  subClass.prototype             = new inheritance();
  subClass.prototype.constructor = subClass;
  subClass.prototype.superClass  = baseClass.prototype;
};

function Demo(container) {
  this.superClass.constructor.call(this, container);
  this.gotoState(1 /* STATE_INIT */);
};
extend(Demo, VT100);

Demo.prototype.keysPressed = function(ch) {
  if (this.state == 5 /* STATE_EXEC */) {
    for (var i = 0; i < ch.length; i++) {
      var c  = ch.charAt(i);
      if (c == '\u0003') {
        this.keys = '';
        this.error('Interrupted');
        return;
      }
    }
  }
  this.keys += ch;
  this.gotoState(this.state);
};

Demo.prototype.gotoState = function(state, tmo) {
  this.state       = state;
  if (!this.timer || tmo) {
    if (!tmo) {
      tmo          = 1;
    }
    this.nextTimer = setTimeout(function(demo) {
                                  return function() {
                                    demo.demo();
                                  };
                                }(this), tmo);
  }
};

Demo.prototype.demo = function() {
  var done                  = false;
  this.nextTimer            = undefined;
  while (!done) {
    var state               = this.state;
    this.state              = 2 /* STATE_PROMPT */;
    switch (state) {
    case 1 /* STATE_INIT */:
      done                  = this.doInit();
      break;
    case 2 /* STATE_PROMPT */:
      done                  = this.doPrompt();
      break;
    case 3 /* STATE_READLINE */:
      done                  = this.doReadLine();
      break;
    case 4 /* STATE_COMMAND */:
      done                  = this.doCommand();
      break;
//    case 5 /* STATE_EXEC */:
//      done                  = this.doExec();
//      break;
//    case 6 /* STATE_NEW_Y_N */:
//      done                  = this.doNewYN();
//      break;
    default:
      done                  = true;
      break;
    }
  }
  this.timer                = this.nextTimer;
  this.nextTimer            = undefined;
};

Demo.prototype.ok = function() {
  this.vt100('OK\r\n');
  this.gotoState(2 /* STATE_PROMPT */);
};

Demo.prototype.error = function(msg) {
  if (msg == undefined) {
    msg                 = 'Syntax Error';
  }
  this.printUnicode((this.cursorX != 0 ? '\r\n' : '') + '\u0007? ' + msg +
                    (this.currentLineIndex >= 0 ? ' in line ' +
                     this.program[this.evalLineIndex].lineNumber() :
                     '') + '\r\n');
  this.gotoState(2 /* STATE_PROMPT */);
  this.currentLineIndex = -1;
  this.evalLineIndex    = -1;
  return undefined;
};

Demo.prototype.doInit = function() {
  this.vars    = new Object();
  this.program = new Array();
  this.printUnicode(
    '\u001Bc\u001B[34;4m' +
    'ShellInABox Demo Script\u001B[24;31m\r\n' +
    '\r\n' +
    'Copyright 2009 by Markus Gutschke <markus@shellinabox.com>\u001B[0m\r\n' +
    '\r\n' +
    'Changed to be a minimal example by Geoff Howland, 2014\u001B[0m\r\n' +
    '\r\n' +
    '\r\n' +
    'This just repeats what you type.  Convert it into something interesting, like RPC invocation or whatever.\r\n' +
    '\r\n');
  this.gotoState(2 /* STATE_PROMPT */);
  return false;
};

Demo.prototype.doPrompt = function() {
  this.keys             = '';
  this.line             = '';
  this.currentLineIndex = -1;
  this.evalLineIndex    = -1;
  this.vt100((this.cursorX != 0 ? '\r\n' : '') + '> ');
  this.gotoState(3 /* STATE_READLINE */);
  return false;
};

Demo.prototype.printUnicode = function(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c < '\x0080') {
      out += c;
    } else {
      var c = s.charCodeAt(i);
      if (c < 0x800) {
        out += String.fromCharCode(0xC0 +  (c >>  6)        ) +
               String.fromCharCode(0x80 + ( c        & 0x3F));
      } else if (c < 0x10000) {
        out += String.fromCharCode(0xE0 +  (c >> 12)        ) +
               String.fromCharCode(0x80 + ((c >>  6) & 0x3F)) +
               String.fromCharCode(0x80 + ( c        & 0x3F));
      } else if (c < 0x110000) {
        out += String.fromCharCode(0xF0 +  (c >> 18)        ) +
               String.fromCharCode(0x80 + ((c >> 12) & 0x3F)) +
               String.fromCharCode(0x80 + ((c >>  6) & 0x3F)) +
               String.fromCharCode(0x80 + ( c        & 0x3F));
      }
    }
  }
  this.vt100(out);
};

Demo.prototype.doReadLine = function() {
  this.gotoState(3 /* STATE_READLINE */);
  var keys  = this.keys;
  this.keys = '';
  for (var i = 0; i < keys.length; i++) {
    var ch  = keys.charAt(i);
    if (ch == '\u0008' || ch == '\u007F') {
      if (this.line.length > 0) {
        this.line = this.line.substr(0, this.line.length - 1);
        if (this.cursorX == 0) {
          var x = this.terminalWidth - 1;
          var y = this.cursorY - 1;
          this.gotoXY(x, y);
          this.vt100(' ');
          this.gotoXY(x, y);
        } else {
          this.vt100('\u0008 \u0008');
        }
      } else {
        this.vt100('\u0007');
      }
    } else if (ch >= ' ') {
      this.line += ch;
      this.printUnicode(ch);
    } else if (ch == '\r' || ch == '\n') {
      this.vt100('\r\n');
      this.gotoState(4 /* STATE_COMMAND */);
      return false;
    } else if (ch == '\u001B') {
      // This was probably a function key. Just eat all of the following keys.
      break;
    }
  }
  return true;
};

Demo.prototype.doCommand = function() {
  this.gotoState(2 /* STATE_PROMPT */);

  this.printUnicode(
    'You typed: ' + this.line + '\r\n'
    );

};


