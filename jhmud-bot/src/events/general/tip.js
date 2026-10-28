'use strict';
/** 文本帧（没有 type 的那些）：战斗、提示、死亡都在这里 */
module.exports = function onTip(line) {
  if (!line) return;
  if (/你死了|你已经死亡|你被.*杀死/.test(line)) {
    console.log('[死亡]', line);
    this.emit('DIE', line);
  }
};
