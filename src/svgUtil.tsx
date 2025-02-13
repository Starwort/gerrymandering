import {ComponentProps} from "solid-js";

declare module "solid-js" {
    namespace JSX {
        interface UseSVGAttributes<T> {
            "xlink:href"?: string | undefined;
        }
    }
}

export function Use(props: ComponentProps<"use">) {
    return <use {...props} xlink:href={props.href} />;
}