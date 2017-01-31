import _ from "underscore";
import assert from "better-assert";
import { QualifiedName } from "lib/datamodel/qualified_name";
import LocalizedText from "lib/datamodel/LocalizedText";
import * as ec from "lib/misc/encode_decode";
import { DataType } from "schemas/DataType_enum";
import { VariantArrayType } from "schemas/VariantArrayType_enum";
import { isNullOrUndefined } from "lib/misc/utils";

function isEnumerationItem(value) {
    return (value instanceof Object && (value.value !== undefined) && value.key);
}


function coerceVariantType(dataType, value) {
    if (isEnumerationItem(value)) {
        // OPCUA Specification 1.0.3 5.8.2 encoding rules for various dataType:
        // [...]Enumeration are always encoded as Int32 on the wire [...]

        // istanbul ignore next
        if (dataType !== DataType.Int32) {
            throw new Error(`expecting DataType.Int32 for enumeration values ; got DataType.${dataType.toString()} instead`);
        }
    }

    switch (dataType) {
    case DataType.Null:
        value = null;
        break;

    case DataType.LocalizedText:
        if (!value || !value._schema || value._schema !== LocalizedText.prototype._schema) {
            value = new LocalizedText(value);
        }
        break;

    case DataType.QualifiedName:
        if (!value || !value._schema || value._schema !== QualifiedName.prototype._schema) {
            value = new QualifiedName(value);
        }
        break;
    case DataType.Int16:
    case DataType.UInt16:
    case DataType.UInt32:
    case DataType.Int32:
        assert(value !== undefined);
        if (isEnumerationItem(value)) {
                // value is a enumeration of some sort
            value = value.value;
        } else {
            value = parseInt(value, 10);
        }
        assert(_.isFinite(value));
        break;
    case DataType.UInt64:
        value = ec.coerceUInt64(value);
        break;
    case DataType.Int64:
        value = ec.coerceInt64(value);
        break;
    case DataType.ExtensionObject:
        break;
    case DataType.DateTime:
        assert(value === null || value instanceof Date);
        break;
    case DataType.String:
        assert(typeof value === "string" || value === null);
        break;
    default:
        assert(dataType !== undefined && dataType !== null, "Invalid DataType");
        break;
    }
    return value;
}


function isValidScalarVariant(dataType, value) {
    assert(value === null || DataType.Int64 === dataType || DataType.ByteString === dataType || DataType.UInt64 === dataType || !(value instanceof Array));
    assert(value === null || !(value instanceof Int32Array));
    assert(value === null || !(value instanceof Uint32Array));
    switch (dataType) {
    case DataType.NodeId:
        return ec.isValidNodeId(value);
    case DataType.String:
        return typeof value === "string" || isNullOrUndefined(value);
    case DataType.Int64:
        return ec.isValidInt64(value);
    case DataType.UInt64:
        return ec.isValidUInt64(value);
    case DataType.UInt32:
        return ec.isValidUInt32(value);
    case DataType.Int32:
        return ec.isValidInt32(value);
    case DataType.UInt16:
        return ec.isValidUInt16(value);
    case DataType.Int16:
        return ec.isValidInt16(value);
    case DataType.Byte:
        return ec.isValidUInt8(value);
    case DataType.SByte:
        return ec.isValidInt8(value);
    default:
        return true;
    }
}

function isValidArrayVariant(dataType, value) {
    if (dataType === DataType.Float && value instanceof Float32Array) {
        return true;
    } else if (dataType === DataType.Double && value instanceof Float64Array) {
        return true;
    } else if (dataType === DataType.SByte && (value instanceof Int8Array)) {
        return true;
    } else if (dataType === DataType.Byte && (value instanceof Buffer || value instanceof Uint8Array)) {
        return true;
    } else if (dataType === DataType.Int16 && value instanceof Int16Array) {
        return true;
    } else if (dataType === DataType.Int32 && value instanceof Int32Array) {
        return true;
    } else if (dataType === DataType.UInt16 && value instanceof Uint16Array) {
        return true;
    } else if (dataType === DataType.UInt32 && value instanceof Uint32Array) {
        return true;
    }
    // array values can be store in Buffer, Float32Array
    assert(_.isArray(value));
    let isValid = true;
    value.forEach((element)/* ,elementIndex*/ => {
        if (!isValidScalarVariant(dataType, element)) {
            isValid = false;
        }
    });
    return isValid;
}

/* istanbul ignore next*/
function isValidMatrixVariant(/* dataType,value*/) {
    assert(false, "not implemented");
}

function isValidVariant(arrayType, dataType, value) {
    assert(dataType);

    switch (arrayType) {
    case VariantArrayType.Scalar:
        return isValidScalarVariant(dataType, value);
    case VariantArrayType.Array:
        return isValidArrayVariant(dataType, value);
    default:
        assert(arrayType === VariantArrayType.Matrix);
        return isValidMatrixVariant(dataType, value);
    }
}


function buildVariantArray(dataType, nbElements, defaultValue) {
    let value;
    switch (dataType) {
    case DataType.Float:
        value = new Float32Array(nbElements);
        break;
    case DataType.Double:
        value = new Float64Array(nbElements);
        break;
    case DataType.UInt32:
        value = new Uint32Array(nbElements);
        break;
    case DataType.Int32:
        value = new Int32Array(nbElements);
        break;
    case DataType.UInt16:
        value = new Uint16Array(nbElements);
        break;
    case DataType.Int16:
        value = new Int16Array(nbElements);
        break;
    case DataType.Byte:
        value = new Uint8Array(nbElements);
        break;
    case DataType.SByte:
        value = new Int8Array(nbElements);
        break;
    default:
            // xx console.log("xxxx DataType = ",dataType ? dataType.toString(): null,"nb Elements =",nbElements);
        value = new Array(nbElements);
        for (let i = 0; i < nbElements; i++) {
            value[i] = defaultValue;
        }
        // xx console.log("xxx done");
    }
    return value;
}


// old version of nodejs do not provide a Buffer#equals test
const oldNodeVersion =  (process.versions.node && process.versions.node.substring(0,1) === "0");

function sameVariant(v1, v2) {
    // xx assert(v1 && v1.constructor.name === "Variant");
    if (v1 === v2) {
        return true;
    }
    if  ((!v1 && v2) || (v1 && !v2)) {
        return false;
    }
    if (v1.arrayType !== v2.arrayType) {
        return false;
    }
    if (v1.dataType !== v2.dataType) {
        return false;
    }
    if (v1.value === v2.value) {
        return true;
    }
    if (v1.arrayType === VariantArrayType.Array) {
        if (!v1.value || !v2.value) {
            return !v1.value && !v2.value;
        }
        if (v1.value.length !== v2.value.length) {
            return false;
        }
        if (v1.value.length == 0 && v2.value.length == 0) {
            return true;
        }
        if (!oldNodeVersion  && v1.value.buffer) {
            // v1 and v2 are TypedArray (such as Int32Array...)
            // this is the most efficient way to compare 2 buffers but it doesn't work with node <= 0.12
            assert(v2.value.buffer);
            // compare byte by byte
            const b1 = Buffer.from(v1.value.buffer);
            const b2 = Buffer.from(v2.value.buffer);
            return b1.equals(b2);
        }
        const n = v1.value.length;
        for (let i = 0; i < n; i++) {
            if (!_.isEqual(v1.value[i], v2.value[i])) {
                return false;
            }
        }
        return true;
    }
    return false;
}

export { 
    coerceVariantType,
    isValidVariant,
    buildVariantArray,
    sameVariant
};