'use strict';
/**
 * 房间帧：服务器推送 {type:"room", path, name, desc, exits, items}
 * this = Socket
 */
module.exports = function onRoom(room) {
  this.room = room;
  console.log(`[房间] ${room.name}  ${room.path}`);
};
