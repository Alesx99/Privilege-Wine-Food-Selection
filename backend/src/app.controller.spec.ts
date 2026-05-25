import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getProducts: jest.fn().mockResolvedValue([{ id: '1', name: 'Barolo' }]),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('products', () => {
    it('should return products', async () => {
      const result = await appController.getProducts();
      expect(result).toEqual([{ id: '1', name: 'Barolo' }]);
      expect(appService.getProducts).toHaveBeenCalled();
    });
  });
});
