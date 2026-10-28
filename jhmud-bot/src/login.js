'use strict';
/**
 * 登录：完全复刻游戏网页的 HTTP 流程
 *  1. POST User/Login                    -> set-cookie c=<uid>
 *  2. POST Servers/GetServer             -> [{Id,Name,Ip,Port}]
 *  3. POST Servers/SelectServer          -> 角色列表
 *  4. POST Role/SelectRole               -> Data = key（WS 登录票据）
 *  5. ws://<Ip>:<Port>  发 "login <key>"
 */
const axios = require('axios');
const qs = require('qs');

const BASE = 'http://175.178.190.184/';

async function post(url, data, cookie) {
  const res = await axios.post(BASE + url, data ? qs.stringify(data) : '', {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    validateStatus: () => true,
    timeout: 20000,
  });
  return res;
}

const jar = (res) =>
  (res.headers['set-cookie'] || []).map((s) => s.split(';')[0]).join('; ');

async function login({ user, pass, role }) {
  // 1. 账号登录
  const r1 = await post('User/Login', { name: user, pwd: pass });
  if (!r1.data || !r1.data.Sucess) throw new Error('登录失败: ' + (r1.data && r1.data.Message));
  const cookie = jar(r1);
  const uid = (cookie.match(/(?:^|;\s*)c=([^;]+)/) || [])[1];
  if (!uid) throw new Error('拿不到 cookie c（用户 id）');

  // 2. 服务器列表
  const r2 = await post('Servers/GetServer?', null, cookie);
  const servers = r2.data && r2.data.Data;
  if (!Array.isArray(servers) || !servers.length) throw new Error('没有可用服务器');
  const srv = servers[0];

  // 3. 选服 -> 角色列表
  const r3 = await post('Servers/SelectServer', {
    id: uid,
    'server[Id]': srv.Id,
    'server[Name]': srv.Name,
    'server[Ip]': srv.Ip,
    'server[Port]': srv.Port,
  }, cookie);
  const roles = r3.data && r3.data.Data;
  if (!Array.isArray(roles) || !roles.length) throw new Error('这个服没有角色');

  // 4. 选角色 -> key
  const target = role ? roles.find((r) => r.Name === role) : roles[0];
  if (!target) throw new Error(`找不到角色 ${role}，现有: ` + roles.map((r) => r.Name).join(','));
  const r4 = await post('Role/SelectRole', {
    Id: target.Id,
    Title: target.Title,
    Name: target.Name,
    IsMove: target.IsMove || '',
  }, cookie);
  if (!r4.data || !r4.data.Sucess) throw new Error('选角色失败: ' + (r4.data && r4.data.Message));
  const key = r4.data.Data;

  return {
    key,
    server: `ws://${srv.Ip}:${srv.Port}`,
    role: target,
    servers,
    roles,
  };
}

module.exports = { login };
