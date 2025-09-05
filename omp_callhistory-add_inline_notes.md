in `/usr/local/NetSapiens/netsapiens-portals/views/callhistory` there are 3 files `index.ctp`, `index_d.ctp`, and `index_u.ctp` these files build the manager portal for superuser/reseller, domain view, and user view respectively.

to add a column to the portal, edit the appropriate file, and find the line of code:
```php
$arry_headers[] = '<th>&nbsp;</th>';
```
just above this line, add your new column header code:
```php
// ...existing header pushes...
if ($this->Uiconfig->isUiConfig('PORTAL_CALLHISTORY_SHOW_NOTES', 'no')) {
    $arry_headers[] = $this->Html->tag('th', __('Notes', true), ['class' => 'notes-header notes']);
}

$arry_headers[] = '<th>&nbsp;</th>'; // keep this last
```

next we need to generate the info for each cell in the call history table, find the line of code:
```php
$fieldArray[] = $btns;
```

and just above that line, add your code to generate the info for your new column per row of data:
```php
if ($this->Uiconfig->isUiConfig('PORTAL_CALLHISTORY_SHOW_NOTES', 'no')) {
    $notes = isset($cdr['Callhistory']['CdrR']['notes']) ? trim($cdr['Callhistory']['CdrR']['notes']) : '';
    $fieldArray[] = ($notes !== '') ? h($notes) : '&nbsp;';
}

$fieldArray[] = $btns; // keep this last
```

be sure to add the ui config (it will need to be done in the admin portal, manager portal doesn't know this new config exists):
PORTAL_CALLHISTORY_SHOW_NOTES = yes
