import type { FastifyRequest, FastifyReply } from 'fastify';
import { authLoginSchema, authSignupSchema } from '@dotor/shared';
import { HTTP_STATUS } from '@dotor/shared';
import type { Logger } from '@dotor/logger';
import { AuthService } from '../services/auth.service.js';
import { ValidationError } from '../lib/errors/index.js';

export class AuthController {
  private authService: AuthService;

  constructor(_logger: Logger) {
    this.authService = new AuthService(_logger);
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Validate input
    const result = authLoginSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.issues);
    }

    const { email, password } = result.data;

    // Call service
    const loginResult = await this.authService.login(email, password);

    // Send response
    await reply.code(HTTP_STATUS.OK).send(loginResult);
  }

  async signup(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Validate input
    const result = authSignupSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.issues);
    }

    const { email, password } = result.data;

    // Call service
    const signupResult = await this.authService.signup(email, password);

    // Send response
    await reply.code(HTTP_STATUS.CREATED).send(signupResult);
  }

  async logout(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Client should clear tokens
    await reply.code(HTTP_STATUS.OK).send({ success: true });
  }
}
