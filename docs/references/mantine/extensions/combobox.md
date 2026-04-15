# Combobox

Basic select

Primitive select component

select

```
import { Combobox, Input, InputBase, useCombobox } from '@mantine/core';

const groceries = [
 '🍎 Apples',
 '🍌 Bananas',
 '🥦 Broccoli',
 '🥕 Carrots',
 '🍫 Chocolate',
 '🍇 Grapes',
];

export function BasicSelect() {
 const combobox = useCombobox({
 onDropdownClose: () => combobox.resetSelectedOption(),
 });

 const [value, setValue] = useState<string | null>(null);

 const options = groceries.map((item) => (
 <Combobox.Option value={item} key={item}>
 {item}
 </Combobox.Option>
 ));

 return (
 <Combobox
 store={combobox}
 withinPortal={false}
 onOptionSubmit={(val) => {
 setValue(val);
 combobox.closeDropdown();
 }}
 >
 <Combobox.Target>
 <InputBase
 component="button"
 type="button"
 pointer
 rightSection={<Combobox.Chevron />}
 onClick={() => combobox.toggleDropdown()}
 rightSectionPointerEvents="none"
 >
 {value || <Input.Placeholder>Pick value</Input.Placeholder>}
 </InputBase>
 </Combobox.Target>

 <Combobox.Dropdown>
 <Combobox.Options>{options}</Combobox.Options>
 </Combobox.Dropdown>
 </Combobox>
 );
}
```

---

Autocomplete with highlight

Autocomplete with highlighted search query in options

autocomplete

Pick value or type anything

```
import { Combobox, Highlight, TextInput, useCombobox } from '@mantine/core';

const groceries = [
 '🍎 Apples',
 '🍌 Bananas',
 '🥦 Broccoli',
 '🥕 Carrots',
 '🍫 Chocolate',
 '🍇 Grapes',
];

export function AutocompleteHighlight() {
 const combobox = useCombobox({
 onDropdownClose: () => combobox.resetSelectedOption(),
 });
 const [value, setValue] = useState('');
 const shouldFilterOptions = !groceries.some((item) => item === value);
 const filteredOptions = shouldFilterOptions
 ? groceries.filter((item) => item.toLowerCase().includes(value.toLowerCase().trim()))
 : groceries;

 const options = filteredOptions.map((item) => (
 <Combobox.Option value={item} key={item}>
 <Highlight highlight={value} size="sm">
 {item}
 </Highlight>
 </Combobox.Option>
 ));

 return (
 <Combobox
 onOptionSubmit={(optionValue) => {
 setValue(optionValue);
 combobox.closeDropdown();
 }}
 withinPortal={false}
 store={combobox}
 >
 <Combobox.Target>
 <TextInput
 label="Pick value or type anything"
 placeholder="Pick value or type anything"
 value={value}
 onChange={(event) => {
 setValue(event.currentTarget.value);
 combobox.updateSelectedOptionIndex();
 combobox.openDropdown();
 }}
 onClick={() => combobox.openDropdown()}
 onFocus={() => combobox.openDropdown()}
 onBlur={() => combobox.closeDropdown()}
 />
 </Combobox.Target>

 <Combobox.Dropdown>
 <Combobox.Options>
 {options.length === 0 ? <Combobox.Empty>Nothing found</Combobox.Empty> : options}
 </Combobox.Options>
 </Combobox.Dropdown>
 </Combobox>
 );
}
```

---

Max selected options

Limit max number of options that can be selected

multiselect

Pick one or more values

```
import { CheckIcon, Combobox, Group, Input, Pill, PillsInput, useCombobox } from '@mantine/core';

const groceries = ['🍎 Apples', '🍌 Bananas', '🥦 Broccoli', '🥕 Carrots', '🍫 Chocolate'];

const ITEMS_LIMIT = 2;

export function MaxSelectedItems() {
 const combobox = useCombobox({
 onDropdownClose: () => combobox.resetSelectedOption(),
 onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
 });

 const [value, setValue] = useState<string[]>([]);

 const handleValueSelect = (val: string) =>
 setValue((current) =>
 current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
 );

 const handleValueRemove = (val: string) =>
 setValue((current) => current.filter((v) => v !== val));

 const values = value.map((item) => (
 <Pill key={item} withRemoveButton onRemove={() => handleValueRemove(item)}>
 {item}
 </Pill>
 ));

 const options = groceries.map((item) => (
 <Combobox.Option
 value={item}
 key={item}
 active={value.includes(item)}
 disabled={value.length >= ITEMS_LIMIT && !value.includes(item)}
 >
 <Group gap="sm">
 {value.includes(item) ? <CheckIcon size={12} /> : null}
 <span>{item}</span>
 </Group>
 </Combobox.Option>
 ));

 return (
 <Combobox store={combobox} onOptionSubmit={handleValueSelect} withinPortal={false}>
 <Combobox.DropdownTarget>
 <PillsInput pointer onClick={() => combobox.toggleDropdown()}>
 <Pill.Group>
 {values.length > 0 ? (
 values
 ) : (
 <Input.Placeholder>Pick one or more values</Input.Placeholder>
 )}

 <Combobox.EventsTarget>
 <PillsInput.Field
 type="hidden"
 onBlur={() => combobox.closeDropdown()}
 onKeyDown={(event) => {
 if (event.key === 'Backspace' && value.length > 0) {
 event.preventDefault();
 handleValueRemove(value[value.length - 1]);
 }
 }}
 />
 </Combobox.EventsTarget>
 </Pill.Group>
 </PillsInput>
 </Combobox.DropdownTarget>

 <Combobox.Dropdown>
 <Combobox.Header>
 You can select up to 2 items, currently selected: {value.length}
 </Combobox.Header>
 <Combobox.Options>{options}</Combobox.Options>
 </Combobox.Dropdown>
 </Combobox>
 );
}
```

---

Creatable multiselect

Multiselect with option to create new options

multiselect

```
import { CheckIcon, Combobox, Group, Pill, PillsInput, useCombobox } from '@mantine/core';

const groceries = ['🍎 Apples', '🍌 Bananas', '🥦 Broccoli', '🥕 Carrots', '🍫 Chocolate'];

export function MultiSelectCreatable() {
 const combobox = useCombobox({
 onDropdownClose: () => combobox.resetSelectedOption(),
 onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
 });

 const [search, setSearch] = useState('');
 const [data, setData] = useState(groceries);
 const [value, setValue] = useState<string[]>([]);

 const exactOptionMatch = data.some((item) => item === search);

 const handleValueSelect = (val: string) => {
 setSearch('');

 if (val === '$create') {
 setData((current) => [...current, search]);
 setValue((current) => [...current, search]);
 } else {
 setValue((current) =>
 current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
 );
 }
 };

 const handleValueRemove = (val: string) =>
 setValue((current) => current.filter((v) => v !== val));

 const values = value.map((item) => (
 <Pill key={item} withRemoveButton onRemove={() => handleValueRemove(item)}>
 {item}
 </Pill>
 ));

 const options = data.filter((item) => item.toLowerCase().includes(search.trim().toLowerCase())).map((item) => (
 <Combobox.Option value={item} key={item} active={value.includes(item)}>
 <Group gap="sm">
 {value.includes(item) ? <CheckIcon size={12} /> : null}
 <span>{item}</span>
 </Group>
 </Combobox.Option>
 ));

 return (
 <Combobox store={combobox} onOptionSubmit={handleValueSelect} withinPortal={false}>
 <Combobox.DropdownTarget>
 <PillsInput onClick={() => combobox.openDropdown()}>
 <Pill.Group>
 {values}

 <Combobox.EventsTarget>
 <PillsInput.Field
 onFocus={() => combobox.openDropdown()}
 onBlur={() => combobox.closeDropdown()}
 value={search}
 placeholder="Search values"
 onChange={(event) => {
 combobox.updateSelectedOptionIndex();
 setSearch(event.currentTarget.value);
 }}
 onKeyDown={(event) => {
 if (event.key === 'Backspace' && search.length === 0 && value.length > 0) {
 event.preventDefault();
 handleValueRemove(value[value.length - 1]);
 }
 }}
 />
 </Combobox.EventsTarget>
 </Pill.Group>
 </PillsInput>
 </Combobox.DropdownTarget>

 <Combobox.Dropdown>
 <Combobox.Options>
 {options}

 {!exactOptionMatch && search.trim().length > 0 && (
 <Combobox.Option value="$create">+ Create {search}</Combobox.Option>
 )}

 {exactOptionMatch && search.trim().length > 0 && options.length === 0 && (
 <Combobox.Empty>Nothing found</Combobox.Empty>
 )}
 </Combobox.Options>
 </Combobox.Dropdown>
 </Combobox>
 );
}
```

---

Select with search in dropdown

Select with search input in the dropdown

---

Select with custom option

Select with custom option and value component

select

```
import { Combobox, Group, Input, InputBase, Text, useCombobox } from '@mantine/core';

interface Item {
 emoji: string;
 value: string;
 description: string;
}

const groceries: Item[] = [
 { emoji: '🍎', value: 'Apples', description: 'Crisp and refreshing fruit' },
 { emoji: '🍌', value: 'Bananas', description: 'Naturally sweet and potassium-rich fruit' },
 { emoji: '🥦', value: 'Broccoli', description: 'Nutrient-packed green vegetable' },
 { emoji: '🥕', value: 'Carrots', description: 'Crunchy and vitamin-rich root vegetable' },
 { emoji: '🍫', value: 'Chocolate', description: 'Indulgent and decadent treat' },
];

function SelectOption({ emoji, value, description }: Item) {
 return (
 <Group>
 <Text fz={20}>{emoji}</Text>
 <div>
 <Text fz="sm" fw={500}>
 {value}
 </Text>
 <Text fz="xs" opacity={0.6}>
 {description}
 </Text>
 </div>
 </Group>
 );
}

export function SelectOptionComponent() {
 const combobox = useCombobox({
 onDropdownClose: () => combobox.resetSelectedOption(),
 });

 const [value, setValue] = useState<string | null>(null);
 const selectedOption = groceries.find((item) => item.value === value);

 const options = groceries.map((item) => (
 <Combobox.Option value={item.value} key={item.value}>
 <SelectOption {...item} />
 </Combobox.Option>
 ));

 return (
 <Combobox
 store={combobox}
 withinPortal={false}
 onOptionSubmit={(val) => {
 setValue(val);
 combobox.closeDropdown();
 }}
 >
 <Combobox.Target>
 <InputBase
 component="button"
 type="button"
 pointer
 rightSection={<Combobox.Chevron />}
 onClick={() => combobox.toggleDropdown()}
 rightSectionPointerEvents="none"
 multiline
 >
 {selectedOption ? (
 <SelectOption {...selectedOption} />
 ) : (
 <Input.Placeholder>Pick value</Input.Placeholder>
 )}
 </InputBase>
 </Combobox.Target>

 <Combobox.Dropdown>
 <Combobox.Options>{options}</Combobox.Options>
 </Combobox.Dropdown>
 </Combobox>
 );
}
```

---

Transfer list

Transfer list with search

other

🍎 Apples

🍌 Bananas

🍓 Strawberries

🥦 Broccoli

🥕 Carrots

🥬 Lettuce

```
import { CaretRightIcon } from '@phosphor-icons/react';
import { ActionIcon, Checkbox, Combobox, Group, TextInput, useCombobox } from '@mantine/core';
import classes from './TransferList.module.css';

const fruits = ['🍎 Apples', '🍌 Bananas', '🍓 Strawberries'];

const vegetables = ['🥦 Broccoli', '🥕 Carrots', '🥬 Lettuce'];

interface RenderListProps {
 options: string[];
 onTransfer: (options: string[]) => void;
 type: 'forward' | 'backward';
}

function RenderList({ options, onTransfer, type }: RenderListProps) {
 const combobox = useCombobox();
 const [value, setValue] = useState<string[]>([]);
 const [search, setSearch] = useState('');

 const handleValueSelect = (val: string) =>
 setValue((current) =>
 current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
 );

 const items = options.filter((item) => item.toLowerCase().includes(search.toLowerCase().trim())).map((item) => (
 <Combobox.Option
 value={item}
 key={item}
 active={value.includes(item)}
 onMouseOver={() => combobox.resetSelectedOption()}
 >
 <Group gap="sm">
 <Checkbox
 checked={value.includes(item)}
 onChange={() => {}}
 aria-hidden
 tabIndex={-1}
 style={{ pointerEvents: 'none' }}
 />
 <span>{item}</span>
 </Group>
 </Combobox.Option>
 ));

 return (
 <div className={classes.renderList} data-type={type}>
 <Combobox store={combobox} onOptionSubmit={handleValueSelect}>
 <Combobox.EventsTarget>
 <Group wrap="nowrap" gap={0} className={classes.controls}>
 <TextInput
 placeholder="Search groceries"
 classNames={{ input: classes.input }}
 value={search}
 onChange={(event) => {
 setSearch(event.currentTarget.value);
 combobox.updateSelectedOptionIndex();
 }}
 />
 <ActionIcon
 radius={0}
 variant="default"
 size={36}
 className={classes.control}
 onClick={() => {
 onTransfer(value);
 setValue([]);
 }}
 >
 <CaretRightIcon className={classes.icon} />
 </ActionIcon>
 </Group>
 </Combobox.EventsTarget>

 <div className={classes.list}>
 <Combobox.Options>
 {items.length > 0 ? items : <Combobox.Empty>Nothing found....</Combobox.Empty>}
 </Combobox.Options>
 </div>
 </Combobox>
 </div>
 );
}

export function TransferList() {
 const [data, setData] = useState<[string[], string[]]>([fruits, vegetables]);

 const handleTransfer = (transferFrom: number, options: string[]) =>
 setData((current) => {
 const transferTo = transferFrom === 0 ? 1 : 0;
 const transferFromData = current[transferFrom].filter((item) => !options.includes(item));
 const transferToData = [...current[transferTo],...options];

 const result = [];
 result[transferFrom] = transferFromData;
 result[transferTo] = transferToData;
 return result as [string[], string[]];
 });

 return (
 <div className={classes.root}>
 <RenderList
 type="forward"
 options={data[0]}
 onTransfer={(options) => handleTransfer(0, options)}
 />
 <RenderList
 type="backward"
 options={data[1]}
 onTransfer={(options) => handleTransfer(1, options)}
 />
 </div>
 );
}
```
