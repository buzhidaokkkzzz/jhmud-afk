'use strict';
/**
 * 事件加载器 —— 对应 wsmud/daily 里的 Daily#loadEvent
 * 约定：src/events/<场景>/<事件名>.js，文件名就是 socket 的 type 名
 *      导出 function () {...}，this 指向 Socket 实例
 */
const fs = require('fs');
const path = require('path');

function loadEvents(sock, scene) {
  const dir = path.join(__dirname, 'events', scene);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => {
      const name = path.basename(f, '.js');
      const handler = require(path.join(dir, f));
      sock.on(name, handler.bind(sock));
      return name;
    });
}

module.exports = { loadEvents };
