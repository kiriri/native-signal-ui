const _ = new WeakMap<object, any[]>();

/**
 * Make sure an object is retained so long as one or more owners still exist.
 * This stops GC from clearing up the value.
 * The owner objects are not modified.
 * It is not guaranteed that the value and its last owner get GCed at the same time,
 * only that the value does not get GCed before its last owner is collected.
 * This function is not cheap. Try to use direct object assignment if performance
 * is key!
 * @param value The value to keep.
 * @param owners The owners which must GC first for the value to be freed.
 * @returns
 */
export function own<T>(value: T, ...owners: object[]): T
{
    for (let owner of owners)
    {
        if (_.has(owner))
            _.get(owner)!.push(value);
        else
            _.set(owner, [value]);
    }

    return value;
}
