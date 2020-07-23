import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const foundCustomer = await this.customersRepository.findById(customer_id);

    if (!foundCustomer) throw new AppError('Invalid customer id');

    const productsId = products.map(product => ({
      id: product.id,
    }));

    const foundProducts = await this.productsRepository.findAllById(productsId);

    const validProducts = products.length === foundProducts.length;
    if (!validProducts) throw new AppError("You can't buy a invalid product");

    const updatedQuantities: IProduct[] = [];

    const orderProducts = foundProducts.map(product => {
      const i = products.findIndex(self => self.id === product.id);
      const currentProduct = products[i];

      if (currentProduct.quantity > product.quantity) {
        throw new AppError(
          `Sorry, we don't have enough ${product.name} in stock.` +
            `Requested ${currentProduct.quantity}.` +
            `Available ${product.quantity}.`,
        );
      }

      updatedQuantities.push({
        id: product.id,
        quantity: product.quantity - currentProduct.quantity,
      });

      return {
        product_id: product.id,
        price: product.price,
        quantity: currentProduct.quantity,
      };
    });

    await this.productsRepository.updateQuantity(updatedQuantities);

    const order = await this.ordersRepository.create({
      customer: foundCustomer,
      products: orderProducts,
    });

    return order;
  }
}

export default CreateOrderService;
