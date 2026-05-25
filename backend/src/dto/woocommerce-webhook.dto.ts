import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class WooCommerceBillingDto {
  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  address_1?: string;

  @IsString()
  @IsOptional()
  postcode?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class WooCommerceLineItemDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class WooCommerceWebhookDto {
  @IsNumber()
  id: number;

  @ValidateNested()
  @Type(() => WooCommerceBillingDto)
  @IsOptional()
  billing?: WooCommerceBillingDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WooCommerceLineItemDto)
  line_items: WooCommerceLineItemDto[];
}
