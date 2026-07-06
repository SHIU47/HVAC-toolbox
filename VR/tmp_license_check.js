const crypto = require('crypto');
const { machineId } = require('node-machine-id');

(async () => {
  const id = await machineId();
  const secret = 'Foxconn-AIdatacenter';
  const legacy = 'Foxconn-AIdatacenterr';
  const data = JSON.stringify({ machineId: id, expiry: '2099-12-31' });

  const make = (s) => {
    const key = crypto.createHash('sha256').update(s).digest();
    const iv = crypto.createHash('md5').update(s).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(data, 'utf8', 'base64');
    enc += cipher.final('base64');
    return enc;
  };

  console.log('machineId=' + id);
  console.log('new=' + make(secret));
  console.log('legacy=' + make(legacy));
})();
