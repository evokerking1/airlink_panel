import { Router, Request, Response } from 'express';
import { Module } from '../../handlers/moduleInit';
import { PrismaClient } from '@prisma/client';
import { isAuthenticatedForServer } from '../../handlers/utils/auth/serverAuthUtil';
import logger from '../../handlers/logger';
import axios from 'axios';

const prisma = new PrismaClient();

interface ErrorMessage {
  message?: string;
}

interface Port {
  primary: boolean;
  Port: number;
}

interface ServerVariable {
  name: string;
  env: string;
  type: 'boolean' | 'text' | 'number';
  default: string | number | boolean;
  value: string | number | boolean;
}


const dashboardModule: Module = {
  info: {
    name: 'Server Module',
    description: 'This file is for dashboard functionality.',
    version: '1.0.0',
    moduleVersion: '1.0.0',
    author: 'AirLinkLab',
    license: 'MIT',
  },

  router: () => {
    const router = Router();

    // Get server info
    router.get(
      '/server/:id',
      isAuthenticatedForServer('id'),
      async (req: Request, res: Response) => {
        const errorMessage: ErrorMessage = {};
        const userId = req.session?.user?.id;
        const serverId = req.params?.id;

        try {
          const user = await prisma.users.findUnique({ where: { id: userId } });
          if (!user) {
            errorMessage.message = 'User not found.';
            return res.render('user/account', { errorMessage, user, req });
          }

          const server = await prisma.server.findUnique({
            where: { UUID: String(serverId) },
            include: { node: true, image: true, owner: true },
          });

          if (!server) {
            errorMessage.message = 'Server not found.';
            return res.render('user/server/manage', {
              errorMessage,
              user,
              req,
              logo: '',
            });
          }

          return res.render('user/server/manage', {
            errorMessage,
            user,
            req,
            server,
            logo: '',
          });
        } catch (error) {
          logger.error('Error fetching user:', error);
          errorMessage.message = 'Error fetching user data.';
          return res.render('user/server/manage', {
            errorMessage,
            user: req.session?.user,
            req,
            logo: '',
          });
        }
      }
    );

    router.post(
      '/server/:id/power/:poweraction',
      isAuthenticatedForServer('id'),
      async (req: Request, res: Response) => {
        const errorMessage: ErrorMessage = {};
        const userId = req.session?.user?.id;
        const serverId = req.params?.id;
        const powerAction = req.params?.poweraction;
    
        try {
          const user = await prisma.users.findUnique({ where: { id: userId } });
          if (!user) {
            errorMessage.message = 'User not found.';
            return res.render('user/account', { errorMessage, user, req });
          }
    
          const server = await prisma.server.findUnique({
            where: { UUID: String(serverId) },
            include: { node: true, image: true, owner: true },
          });
    
          if (!server) {
            errorMessage.message = 'Server not found.';
            return res.render('user/server/manage', { errorMessage, user, req });
          }
    
          if (powerAction === 'stop') {
            const requestData = {
              method: 'POST',
              url: `http://${server.node.address}:${server.node.port}/container/stop`,
              auth: {
                username: 'Airlink',
                password: server.node.key,
              },
              headers: {
                'Content-Type': 'application/json',
              },
              data: {
                id: String(serverId),
                stopCmd: 'stop',
              },
            };
    
            try {
              const response = await axios(requestData);
              logger.info('Container stopped successfully:' + response.data);
              return res.redirect(`/server/${serverId}`);
            } catch (stopError) {
              logger.error('Error stopping container:', stopError);
              errorMessage.message = 'Error stopping the server.';
              return res.render('user/server/manage', {
                errorMessage,
                user: req.session?.user,
                req,
                logo: '',
              });
            }
          }
    
          const ports = (JSON.parse(server.Ports) as Port[])
            .filter((port) => port.primary)
            .map((port) => port.Port)
            .pop();
    
          const envVariables: Record<string, string | number | boolean> = {};
          if (server.Variables) {
            try {
              const serverVariables = JSON.parse(server.Variables) as ServerVariable[];
              serverVariables.forEach((variable) => {
                if (variable.env && variable.value !== undefined && variable.type) {
                  let processedValue: string | number | boolean;
                  switch (variable.type) {
                  case 'boolean':
                    processedValue = variable.value === 1 || variable.value === '1' ? 'true' : 'false';
                    break;
                  case 'number':
                    processedValue = Number(variable.value);
                    break;
                  case 'text':
                    processedValue = String(variable.value);
                    break;
                  default:
                    processedValue = variable.value;
                  }
                  envVariables[variable.env] = processedValue;
                }
              });
            } catch (error) {
              logger.error('Fehler beim Parsen von server.Variables:', error);
              throw new Error('Invalid format in server.Variables');
            }
          }
    
          const startRequestData = {
            method: 'POST',
            url: `http://${server.node.address}:${server.node.port}/container/start`,
            auth: {
              username: 'Airlink',
              password: server.node.key,
            },
            headers: {
              'Content-Type': 'application/json',
            },
            data: {
              id: String(serverId),
              image: String(server.image?.image),
              ports: ports,
              Memory: server.Memory * 1024,
              Cpu: server.Cpu,
              env: envVariables,
            },
          };
    
          const startResponse = await axios(startRequestData);
          logger.info('Container started successfully:' + startResponse.data);
    
          return res.redirect(`/server/${serverId}`);
        } catch (error) {
          logger.error('Error processing power action:', error);
          errorMessage.message = 'Error processing server action.';
          return res.render('user/server/manage', {
            errorMessage,
            user: req.session?.user,
            req,
            logo: '',
          });
        }
      }
    );

    router.get(
      '/server/:id/files',
      isAuthenticatedForServer('id'),
      async (req: Request, res: Response) => {
        const errorMessage: ErrorMessage = {};
        const userId = req.session?.user?.id;
        const serverId = req.params?.id;

        try {
          const user = await prisma.users.findUnique({ where: { id: userId } });
          if (!user) {
            errorMessage.message = 'User not found.';
            return res.render('user/account', { errorMessage, user, req });
          }

          const server = await prisma.server.findUnique({
            where: { UUID: String(serverId) },
            include: { node: true, image: true, owner: true },
          });

          if (!server) {
            errorMessage.message = 'Server not found.';
            return res.render('user/server/files', {
              errorMessage,
              user,
              req,
              logo: '',
            });
          }

          const filesRequest = {
            method: 'GET',
            url: `http://${server.node.address}:${server.node.port}/fs/list?id=${server.UUID}`,
            auth: {
              username: 'Airlink',
              password: server.node.key,
            },
            headers: {
              'Content-Type': 'application/json',
            }
          };

          let files = await axios(filesRequest);
          files = files.data;

          return res.render('user/server/files', {
            errorMessage,
            user,
            files,
            req,
            server,
            logo: '',
          });
        } catch (error) {
          logger.error('Error fetching user:', error);
          errorMessage.message = 'Error fetching user data.';
          return res.render('user/server/files', {
            errorMessage,
            user: req.session?.user,
            req,
            logo: '',
          });
        }
      }
    );

    

    return router;
  },
};

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

export default dashboardModule;
