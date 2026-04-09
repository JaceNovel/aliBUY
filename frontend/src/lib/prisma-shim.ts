type BaseJsonPrimitive = string | number | boolean | null;
type BaseJsonObject = { [key: string]: BaseJsonValue };
type BaseJsonArray = BaseJsonValue[];
type BaseJsonValue = BaseJsonPrimitive | BaseJsonObject | BaseJsonArray;

type BaseInputJsonObject = { [key: string]: BaseInputJsonValue | null };
type BaseInputJsonArray = Array<BaseInputJsonValue | null>;
type BaseInputJsonValue = string | number | boolean | BaseInputJsonObject | BaseInputJsonArray | { toJSON(): unknown };

export const Prisma = {
  JsonNull: null as null,
};

export namespace Prisma {
  export type JsonValue = BaseJsonValue;
  export type InputJsonValue = BaseInputJsonValue;
  export type NullableJsonNullValueInput = BaseInputJsonValue | null;
}

export type PrismaClient = Record<string | symbol, any>;