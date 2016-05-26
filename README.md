# on-demand-app-gen
*A simple On-demand app generation extension for Qlik Sense (requires Qlik Sense Enterprise)*

This extension allows you to make selections in a Qlik Sense app and then clone it, using the selections to modify the script and reduce the data. Currently the app only copies sheets, objects and the script.

###Properties
####Measures (required)
A single measure is required. This measure is used to determine if the data has been reduced enough to allow the app to be copied.
*i.e. Count(CustomerID)*
#####Row Limit (required)
This is a new property against the measures. It determines the limit to use for the defined measure. Once the result of the measure is equal to or less than the limit, you will be able to copy the app.

####Advanced
When selecting multiple values, the extension will build an 'IN' statement to add to the WHERE clause in the appropriate part of the Load script. The following options allow the 'IN' statement to be tailored for systems that support a different syntax.
#####Where Operator
Allows you to change the Keyword used to create the IN statement
The default value is 'IN'
#####Values in Parentheses
Specifies whether or not multiple values should be enclosed in parentheses ()
Defaults to *true*
#####Quote Character
Allows you to change how the values should be 'quoted'.
Defaults to a single quote 
#####Value Delimeter
Allows you to change how multiple values should be delimeted.
Defaults to a comma

A different in statement would appear like this -
*WHERE _field_ IN (_'valueA'_,_'valueB'_,...)*
