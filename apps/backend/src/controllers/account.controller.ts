import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Logger } from '@dotor/logger';
import { HTTP_STATUS } from '@dotor/shared';
import { z } from 'zod';
import { AccountService } from '../services/account.service.js';
import { ValidationError } from '../lib/errors/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

const updatePasswordSchema = z.object({
  password: z.string().min(6),
});

export class AccountController {
  private accountService: AccountService;

  constructor(logger: Logger) {
    this.accountService = new AccountService(logger);
  }

  async getSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    try {
      const session = await this.accountService.getSession(authRequest.accessToken);
      await reply.code(HTTP_STATUS.OK).send(session);
    } catch (error) {
      if (error instanceof Error) {
        await reply.code(HTTP_STATUS.UNAUTHORIZED).send({ error: error.message });
      } else {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to get session' });
      }
    }
  }

  async getProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    try {
      const profile = await this.accountService.getProfile(authRequest.accessToken);
      await reply.code(HTTP_STATUS.OK).send(profile);
    } catch (error) {
      if (error instanceof Error) {
        await reply.code(HTTP_STATUS.UNAUTHORIZED).send({ error: error.message });
      } else {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to get profile' });
      }
    }
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    const parseResult = updateProfileSchema.safeParse(request.body);

    if (!parseResult.success) {
      throw new ValidationError('Invalid request body', parseResult.error.issues);
    }

    const { name } = parseResult.data;

    if (!name) {
      throw new ValidationError('Name is required');
    }

    try {
      await this.accountService.updateProfile(authRequest.userId, name);
      await reply.code(HTTP_STATUS.OK).send({ 
        success: true, 
        message: 'Profile updated successfully' 
      });
    } catch (error) {
      if (error instanceof Error) {
        await reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: error.message });
      } else {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to update profile' });
      }
    }
  }

  async updatePassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    const parseResult = updatePasswordSchema.safeParse(request.body);

    if (!parseResult.success) {
      throw new ValidationError('Invalid request body', parseResult.error.issues);
    }

    const { password } = parseResult.data;

    try {
      await this.accountService.updatePassword(authRequest.userId, password);
      await reply.code(HTTP_STATUS.OK).send({ 
        success: true, 
        message: 'Password updated successfully' 
      });
    } catch (error) {
      if (error instanceof Error) {
        await reply.code(HTTP_STATUS.BAD_REQUEST).send({ error: error.message });
      } else {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to update password' });
      }
    }
  }

  async signout(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.code(HTTP_STATUS.OK).send({ success: true });
  }

  async deleteAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    try {
      await this.accountService.deleteAccount(authRequest.userId);
      await reply.code(HTTP_STATUS.OK).send({ 
        success: true, 
        message: 'Account deleted successfully' 
      });
    } catch (error) {
      if (error instanceof Error) {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: error.message });
      } else {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to delete account' });
      }
    }
  }

  async getFeatureFlags(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    try {
      const flags = await this.accountService.getFeatureFlags(authRequest.userId);
      await reply.code(HTTP_STATUS.OK).send({ flags });
    } catch (error) {
      await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ 
        error: 'Failed to get feature flags' 
      });
    }
  }
}
