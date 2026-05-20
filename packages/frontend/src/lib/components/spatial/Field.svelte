<script lang="ts">
  type Props = {
    id: string;
    label?: string;
    value: string | number;
    type?: 'text' | 'password' | 'email' | 'number' | 'textarea';
    placeholder?: string;
    autocomplete?: AutoFill;
    required?: boolean;
    autofocus?: boolean;
    rows?: number;
    min?: number;
    max?: number;
    minlength?: number;
    onInput?: (v: string) => void;
  };

  let {
    id,
    label,
    value = $bindable(),
    type = 'text',
    placeholder,
    autocomplete,
    required = false,
    autofocus = false,
    rows,
    min,
    max,
    minlength,
    onInput,
  }: Props = $props();

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const v = target.value;
    value = type === 'number' ? (v === '' ? '' : Number(v)) : v;
    onInput?.(v);
  }

  function focusOnMount(node: HTMLElement) {
    if (autofocus) node.focus();
  }
</script>

<label class="sp-field" for={id}>
  {#if label}<span class="sp-field__label">{label}</span>{/if}
  <span
    class="chev chev--block chev--hover"
    style="--chev-color: var(--sp-accent-dim); --chev-size: 8px; --chev-inset: -5px;"
  >
    {#if type === 'textarea'}
      <textarea
        {id}
        class="sp-field__input sp-field__input--textarea"
        {value}
        {placeholder}
        {autocomplete}
        {required}
        {rows}
        {minlength}
        oninput={handleInput}
        use:focusOnMount
      ></textarea>
    {:else}
      <input
        {id}
        {type}
        class="sp-field__input"
        {value}
        {placeholder}
        {autocomplete}
        {required}
        {min}
        {max}
        {minlength}
        oninput={handleInput}
        use:focusOnMount
      />
    {/if}
  </span>
</label>
