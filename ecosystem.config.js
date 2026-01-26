module.exports = {
    apps: [
        {
            name: 'privos-server',
            cwd: '/home/roxane/Privos/Flowise/packages/server',
            script: 'node',
            args: 'bin/start-patched.js',
            env: {
                NODE_ENV: 'production',
                PORT: 3002
            },
            watch: false,
            autorestart: true,
            max_memory_restart: '1G'
        }
    ]
}
