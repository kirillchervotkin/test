import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserYdbRepository } from './user/user.repository.js';

@Injectable()
export class AdminInitializationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminInitializationService.name);

  constructor(private readonly userRepository: UserYdbRepository) {}

  async onApplicationBootstrap() {
    await this.initializeAdminUser();
  }

  private async initializeAdminUser(): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Admin';
      const adminLastName = process.env.ADMIN_LAST_NAME || 'Admin';

      if (!adminEmail || !adminPassword) {
        this.logger.warn(
          'ADMIN_EMAIL or ADMIN_PASSWORD environment variables are not set. Admin user initialization skipped.',
        );
        return;
      }

      const existingAdmin = await this.userRepository.findByEmail(adminEmail);

      if (existingAdmin) {
        this.logger.log(`Admin user already exists: ${adminEmail}`);
        return;
      }

      const passwordHash = await bcrypt.hash(adminPassword, 10);

      // Используем createUser с соответствующими полями
      await this.userRepository.createUser({
        firstName: adminFirstName,
        lastName: adminLastName,
        email: adminEmail,
        passwordHash,
        isActive: true,
        birthDate: undefined,
      });

      this.logger.log(`Admin user created successfully: ${adminEmail}`);
    } catch (error) {
      this.logger.error('Failed to initialize admin user:', error);
    }
  }
}
