export class HealthService {
  getStatus(): { status: string; timestamp: string; service: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'dotor-backend',
    };
  }
}
