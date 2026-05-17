import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class ActivityDocumentDto {
  @IsString()
  @IsNotEmpty()
  documentName!: string;

  @IsUrl()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileMime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSizeBytes?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
