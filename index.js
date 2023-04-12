const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const app = express();

// 存储xray进程的变量
let xrayProcess = null;

app.use(express.static(path.join(__dirname, 'web')));

// 身份认证中间件
function authenticateUser(req, res, next) {
  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).send('Unauthorized');
  }
  // 读取密码文件
  const passwordPath = path.join(__dirname, 'password.txt');
  try {
    const password = fs.readFileSync(passwordPath, 'utf8');
    if (authorization !== password) {
      return res.status(401).send('Unauthorized');
    }
    // 身份验证成功，继续处理请求
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error reading password');
  }
  // 解码凭据并进行验证 
  // const [username, password] = Buffer.from(authorization.split(' ')[1], 'base64').toString().split(':');
}

// 启动xray进程的函数
function startProcess() {
  const xrayPath = path.join(__dirname, 'xray', 'xray');
  const configPath = path.join(__dirname, 'xray', 'config.json');
  // 使用spawn函数启动xray进程，并将configPath作为参数传入
  xrayProcess = spawn(xrayPath, ['-config', configPath]);
  // 监听进程的stdout和stderr事件，并将输出打印到控制台
  xrayProcess.stdout.on('data', data => console.log(data.toString()));
  xrayProcess.stderr.on('data', data => console.error(data.toString()));
}

// 处理config.json文件的请求
// 如果请求的是GET方法，表示查看config.json文件
app.get('/config', authenticateUser, (req, res) => {
  const configPath = path.join(__dirname, 'xray', 'config.json');
  try {
    // 读取config.json文件的内容并返回到客户端
    const config = fs.readFileSync(configPath, 'utf8');
    res.status(200).send(config);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error reading config');
  }

});

// 如果请求的是POST方法，表示修改config.json文件
app.post('/config', authenticateUser, (req, res) => {
  const configPath = path.join(__dirname, 'xray', 'config.json');
  // 从请求中获取config.json文件的新内容
  let newConfig = '';
  req.on('data', chunk => {
    newConfig += chunk.toString();
  });
  req.on('end', () => {
    try {
      // 将新内容写入config.json文件
      fs.writeFileSync(configPath, newConfig);
      res.status(200).send('Config updated successfully');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error updating config');
    }
  });
});

// 处理xray进程状态的请求
app.get('/status', authenticateUser, (req, res) => {
  if (xrayProcess && xrayProcess.exitCode === null) {
    res.status(200).send('Xray is running.');
  } else {
    res.status(200).send('Xray is not running.');
  }
});

// 启动xray进程的接口
app.post('/start', authenticateUser, (req, res) => {
  if (xrayProcess && xrayProcess.exitCode === null) {
    res.status(400).send('Xray is already running');
  } else {
    startProcess();
    res.status(200).send('Xray started');
  }
});

// 重启xray进程的接口
app.post('/restart', authenticateUser, (req, res) => {
  if (xrayProcess && xrayProcess.exitCode === null) {
    xrayProcess.kill(); // 先停止xray进程
  }
  startProcess(); // 再启动xray进程
  res.status(200).send('Xray restarted');
});

// 停止xray进程的接口
app.post('/stop', authenticateUser, (req, res) => {
  if (xrayProcess && xrayProcess.exitCode === null) {
    xrayProcess.kill();
    xrayProcess = null;
    console.log('Xray stopped');
    res.status(200).send('Xray stopped');
  } else {
    res.status(400).send('Xray is not running');
  }
});

// 处理流量统计的请求
app.get('/traffic', authenticateUser, (req, res) => {
  const xrayPath = path.join(__dirname, 'xray', 'xray');
  // 使用exec函数执行xray api命令
  exec(`${xrayPath} api statsquery -s=127.0.0.1:6789`, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error getting stats');
    }
    res.status(200).send(stdout);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
