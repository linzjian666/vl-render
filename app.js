const username = "admin";
const password = "passwd@123";
const url = "https://" + process.env.RENDER_EXTERNAL_HOSTNAME;
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
var exec = require("child_process").exec;
const os = require("os");
const { createProxyMiddleware } = require("http-proxy-middleware");
var request = require("request");
const fetch = require("node-fetch");
const fs = require('fs');
const yaml = require('js-yaml');

let data = {
  log:
    loglevel: info
  dns:
    servers:
    - https+local://8.8.8.8/dns-query
  inbounds:
  - port: 8080
    protocol: vless
    settings:
      clients:
      - id: "3e7e830a-9be5-41c1-ad8b-b08403f33782"
      decryption: "none"
    streamSettings:
      network: ws
      wsSettings:
        path: "/3e7e830a-9be5-41c1-ad8b-b08403f33782-vless"
    sniffing:
      enabled: true
      destOverride:
      - http
      - tls
      - quic
  outbounds:
  - protocol: freedom
  - tag: WARP
    protocol: wireguard
    settings:
      secretKey: "uC8wYr2q+VgqyGkUmnNxz5PR8rTVEfTolsed0YK7LG4="
      address:
        - 172.16.0.2/32
        - 2606:4700:110:8a36:df92:102a:9602:fa18/128
      peers:
        publicKey: "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo="
        allowedIPs:
          - 0.0.0.0/0
          - ::/0
        endpoint: "162.159.193.10:2408"
      mtu: 1280
  routing:
    domainStrategy: AsIs
    rules:
      - type: field
        domain:
          - domain:ai.com
          - domain:auth0.com
          - domain:challenges.cloudflare.com
          - domain:client-api.arkoselabs.com
          - domain:events.statsigapi.net
          - domain:featuregates.org
          - domain:identrust.com
          - domain:intercom.io
          - domain:intercomcdn.com
          - domain:openai.com
          - domain:openaiapi-site.azureedge.net
          - domain:sentry.io
          - domain:stripe.com
        outboundTag: WARP
};

let yamlStr = yaml.safeDump(data);
fs.writeFileSync('config.yaml', yamlStr, 'utf8');

app.use((req, res, next) => {
  const user = auth(req);
  if (user && user.name === username && user.pass === password) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Node"');
  return res.status(401).send();
});

app.get("/", (req, res) => {
  res.send("Hello world!!")
  /*伪装站点，由于太卡了,会急剧降低容器性能，建议不要开启
  let fake_site_url = "https://www.qidian.com/"
  fetch(fake_site_url).then((res) => res.text()).then((html) => res.send(html));
  */
});

app.get("/status", function (req, res) => {
  let cmdStr = "ps -ef";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.type("html").send("<pre>命令行执行错误：\n" + err + "</pre>");
    } else {
      res.type("html").send("<pre>命令行执行结果：\n" + stdout + "</pre>");
    }
  });
});

app.get("/start", function (req, res) => {
  let cmdStr = "./web -c ./config.yaml >/dev/null 2>&1 &";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令行执行错误：" + err);
    } else {
      res.send("命令行执行结果：启动成功!");
    }
  });
});

app.get("/info", function (req, res) => {
  let cmdStr = "cat /etc/*release | grep -E ^NAME";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令行执行错误：" + err);
    } else {
      res.send(
        "命令行执行结果：\n" + "Linux System:" + stdout + "\nRAM:" + os.totalmem() / 1000 / 1000 + "MB"
      );
    }
  });
});

app.use(
  "/",
  createProxyMiddleware({
    changeOrigin: true, // 默认false，是否需要改变原始主机头为目标URL
    onProxyReq: function onProxyReq(proxyReq, req, res) {},
    pathRewrite: {
      // 请求中去除/
      "^/": "/",
    },
    target: "http://127.0.0.1:8080/", // 需要跨域处理的请求地址
    ws: true, // 是否代理websockets
    onProxyReq: function onProxyReq(proxyReq, req, res) {
      // 我就打个log康康
      console.log("-->  ", req.method, req.baseUrl, "->", proxyReq.host + proxyReq.path
      );
    },
  })
);

/* keepalive  begin */
function keepalive() {
  // 1.请求主页，保持唤醒
  let render_app_url = url;
  request(render_app_url, function (error, response, body) {
    if (!error) {
      console.log("主页发包成功！");
      console.log("响应报文:", body);
    } else console.log("请求错误: " + error);
  });

  // 2.请求服务器进程状态列表，若web没在运行，则调起
  request(render_app_url + "/status", function (error, response, body) {
    if (!error) {
      if (body.indexOf("./web -c ./config.yaml") != -1) {
        console.log("web正在运行");
      } else {
        console.log("web未运行,发请求调起");
        request(render_app_url + "/start", function (err, resp, body) {
          if (!err) console.log("调起web成功:" + body);
          else console.log("请求错误:" + err);
        });
      }
    } else console.log("请求错误: " + error);
  });
}
setInterval(keepalive, 9 * 1000);
/* keepalive  end */

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
