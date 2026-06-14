import type { Computed, NativeSignal } from "native-signal/weak";

export type BaseContents = number | string | boolean | {to_html():Contents} | Promise<Contents> | Element | Comment | DocumentFragment;
export type Contents = BaseContents | BaseContents[] | Computed<BaseContents|BaseContents[]> | NativeSignal<BaseContents|BaseContents[]>;

export abstract class Component<NODE extends Element = Element>
{
    abstract root : NODE;
    to_html():NODE
    {
        return this.root;
    };

    destroy()
    {
        this.root.remove();
    }
}