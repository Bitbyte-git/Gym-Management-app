const dns = require('node:dns');
const mongoose = require('mongoose');
const config = require('./env');

if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((value) => value.trim()).filter(Boolean));
}

const buildDirectUri = (srvUri) => {
  if (!srvUri.startsWith('mongodb+srv://') || config.mongodbFallbackHosts.length === 0) return null;

  const directUri = srvUri.replace(
    /^mongodb\+srv:\/\/((?:[^@/]+)@)?[^/]+/,
    `mongodb://$1${config.mongodbFallbackHosts.join(',')}`,
  );
  const separator = directUri.includes('?') ? '&' : '?';
  const options = new URLSearchParams({
    tls: 'true',
    replicaSet: config.mongodbReplicaSet,
    authSource: 'admin',
  });

  return `${directUri}${separator}${options}`;
};

module.exports = async () => {
  const options = {
    serverSelectionTimeoutMS: 10000,
    autoIndex: config.nodeEnv !== 'production',
  };
  let conn;

  try {
    conn = await mongoose.connect(config.mongodbUri, options);
  } catch (error) {
    const isDnsFailure = ['ECONNREFUSED', 'ETIMEOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(error.code);
    if (!isDnsFailure) throw error;

    // Retry SRV lookup using public DNS (8.8.8.8, 1.1.1.1) if local/ISP DNS refuses SRV queries
    if (!process.env.DNS_SERVERS && config.mongodbUri.startsWith('mongodb+srv://')) {
      try {
        console.warn(`MongoDB SRV lookup failed (${error.code}); retrying with public DNS (8.8.8.8, 1.1.1.1)`);
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        conn = await mongoose.connect(config.mongodbUri, options);
        console.log('MongoDB connected');
        return conn;
      } catch (retryError) {
        console.warn(`Public DNS retry failed (${retryError.code})`);
      }
    }

    const directUri = buildDirectUri(config.mongodbUri);
    if (!directUri) throw error;

    console.warn(`MongoDB SRV lookup failed (${error.code}); retrying with configured Atlas hosts`);
    conn = await mongoose.connect(directUri, options);
  }

  console.log('MongoDB connected');
  return conn;
};
