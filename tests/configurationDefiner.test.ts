import { test, describe } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { createConfigManager } from '../generic/configurationDefiner.js';

describe('configurationDefiner', () => {
    
    const Schema = z.object({
        server: z.object({
            host: z.ipv4().or(z.literal('localhost')),
            port: z.number().int().min(1024).max(65535),
            env: z.enum(['development', 'staging', 'production']),
        }),
        database: z.object({
            urls: z.array(z.string().url()).min(1),
            options: z.object({
                timeout: z.number().positive().default(5000),
                retries: z.number().int().min(0).max(5),
            }),
        }),
        auth: z.object({
            providers: z.array(z.object({
                name: z.string(),
                clientId: z.string(),
                secret: z.string().min(10),
            })),
            session: z.object({
                ttl: z.number().min(60),
                secure: z.boolean(),
            }),
        }),
    }).refine((data) => {
        if (data.server.env === 'production' && !data.auth.session.secure) {
            return false;
        }
        return true;
    }, {
        message: "Secure sessions are required in production",
        path: ["auth", "session", "secure"]
    });

    type Config = z.infer<typeof Schema>;

    test('initializes and retrieves valid configuration', async () => {
        const manager = createConfigManager(Schema, 'TestApp');

        const validConfig = {
            server: {
                host: 'localhost',
                port: 3000,
                env: 'development',
            },
            database: {
                urls: ['postgres://localhost:5432/db'],
                options: { retries: 3 }
            },
            auth: {
                providers: [{ name: 'google', clientId: '123', secret: 'supersecret123' }],
                session: { ttl: 3600, secure: false }
            }
        };

        await manager.defineConfiguration(validConfig);
        const config = manager.getConfiguration();
        
        assert.deepStrictEqual(config.server, validConfig.server);
        assert.strictEqual(config.database.options.timeout, 5000);
    });

    test('throws detailed error for invalid schema structure', async () => {
        const manager = createConfigManager(Schema, 'TestApp');

        const invalidConfig = {
            server: {
                host: 'not-an-ip',
                port: 80,
                env: 'production',
            },
            database: {
                urls: [],
            },
            auth: {
                providers: [{ name: 'google', clientId: '123', secret: 'short' }],
                session: { ttl: 3600, secure: true }
            }
        };

        try {
            await manager.defineConfiguration(invalidConfig);
            assert.fail('Should have thrown validation error');
        } catch (err: any) {
            assert.ok(err.message.includes('Configuration validation failed'));
            assert.ok(err.message.includes('server.host'));
            assert.ok(err.message.includes('server.port'));
            assert.ok(err.message.includes('database.urls'));
            assert.ok(err.message.includes('auth.providers.0.secret'));
        }
    });

    test('throws error for invalid refined logic', async () => {
        const manager = createConfigManager(Schema, 'TestApp');

        const invalidRefinementConfig = {
            server: {
                host: '127.0.0.1',
                port: 3000,
                env: 'production',
            },
            database: {
                urls: ['postgres://localhost:5432/db'],
                options: { retries: 3 }
            },
            auth: {
                providers: [{ name: 'google', clientId: '123', secret: 'supersecret123' }],
                session: { ttl: 3600, secure: false }
            }
        };

        try {
            await manager.defineConfiguration(invalidRefinementConfig);
            assert.fail('Should have thrown refinement error');
        } catch (err: any) {
            assert.ok(err.message.includes('Secure sessions are required in production'));
        }
    });

    test('throws error if getConfiguration is called before definition', () => {
        const manager = createConfigManager(Schema, 'TestApp');
        
        assert.throws(() => {
            manager.getConfiguration();
        }, /Configuration must be initialized/);
    });

    test('returns frozen immutable configuration object', async () => {
        const manager = createConfigManager(Schema, 'TestApp');
        const validConfig = {
            server: { host: 'localhost', port: 8080, env: 'development' },
            database: { urls: ['http://db.com'], options: { retries: 1 } },
            auth: { providers: [], session: { ttl: 60, secure: false } }
        };

        await manager.defineConfiguration(validConfig);
        const config = manager.getConfiguration();

        assert.ok(Object.isFrozen(config));
        

        try {
            config.server.port = 9000;
        } catch (e) {
        
        }
        
        assert.throws(() => {
            config.server = { ...config.server, port: 9000 };
        }, /Cannot assign to read only property/);
    });
});
